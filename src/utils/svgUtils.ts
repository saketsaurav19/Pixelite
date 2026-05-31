import type { Layer } from '../store/types';

export const parseSVG = async (svgString: string): Promise<Layer[]> => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  const svg = doc.querySelector('svg');
  if (!svg) {
    throw new Error("Invalid SVG document");
  }

  const layers: Layer[] = [];

  // Recursively process nodes
  const processNode = async (node: Element, parentMatrix: DOMMatrix = new DOMMatrix()): Promise<Layer | Layer[] | null> => {
    const nodeName = node.nodeName.toLowerCase();

    // Ignore non-rendering elements
    if (['defs', 'clipPath', 'style', 'script', 'title', 'desc', 'metadata'].includes(nodeName)) {
      return null;
    }

    // Attempt to extract local transform
    let currentMatrix = parentMatrix;
    const transformAttr = node.getAttribute('transform');
    if (transformAttr) {
      // Browsers can parse transform strings into DOMMatrix via SVG elements or CSS
      // Note: for robustness in simple environments, a small wrapper could be used,
      // but modern browsers support new DOMMatrix(transformAttr).
      try {
        const localMatrix = new DOMMatrix(transformAttr);
        currentMatrix = parentMatrix.multiply(localMatrix);
      } catch (e) {
        console.warn("Failed to parse transform:", transformAttr, e);
      }
    }

    // Basic styling
    const fill = node.getAttribute('fill') || (nodeName === 'path' || nodeName === 'rect' || nodeName === 'circle' || nodeName === 'polygon' || nodeName === 'ellipse' ? '#000000' : undefined);
    const stroke = node.getAttribute('stroke');
    const strokeWidthStr = node.getAttribute('stroke-width');
    const strokeWidth = strokeWidthStr ? parseFloat(strokeWidthStr) : (stroke ? 1 : 0);

    const name = node.getAttribute('id') || nodeName;
    const opacityStr = node.getAttribute('opacity');
    const opacity = opacityStr ? parseFloat(opacityStr) : 1;
    const isVisible = node.getAttribute('display') !== 'none' && node.getAttribute('visibility') !== 'hidden';

    // Base Layer template
    const baseLayer = {
      id: Math.random().toString(36).substring(7),
      name: name,
      visible: isVisible,
      locked: false,
      opacity: opacity,
      blendMode: 'source-over' as any,
      position: { x: 0, y: 0 }
    };

    if (nodeName === 'g') {
      const childrenLayers: Layer[] = [];
      const children = Array.from(node.children);
      for (const child of children) {
        const parsed = await processNode(child, currentMatrix);
        if (parsed) {
          if (Array.isArray(parsed)) {
            childrenLayers.push(...parsed);
          } else {
            childrenLayers.push(parsed);
          }
        }
      }

      if (childrenLayers.length === 0) return null;

      return {
        ...baseLayer,
        type: 'group',
        children: childrenLayers,
        collapsed: false
      } as Layer;
    }

    if (nodeName === 'image') {
      const href = node.getAttribute('href') || node.getAttribute('xlink:href');
      if (!href) return null;

      const x = parseFloat(node.getAttribute('x') || '0');
      const y = parseFloat(node.getAttribute('y') || '0');

      return {
        ...baseLayer,
        type: 'image',
        dataUrl: href,
        position: { x, y }
      } as Layer;
    }

    if (['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'].includes(nodeName)) {
      // In a real editor, we would convert rect/circle to specific shape formats,
      // but since we added svgPath support to our 'path' shape type,
      // the most robust way is to just grab the 'd' for paths,
      // or serialize the node back to an svg and render it, OR map basic primitives to paths.

      let svgPath = '';
      if (nodeName === 'path') {
        svgPath = node.getAttribute('d') || '';
      } else if (nodeName === 'rect') {
        const x = parseFloat(node.getAttribute('x') || '0');
        const y = parseFloat(node.getAttribute('y') || '0');
        const w = parseFloat(node.getAttribute('width') || '0');
        const h = parseFloat(node.getAttribute('height') || '0');
        svgPath = `M ${x} ${y} h ${w} v ${h} h ${-w} Z`;
      } else if (nodeName === 'circle') {
        const cx = parseFloat(node.getAttribute('cx') || '0');
        const cy = parseFloat(node.getAttribute('cy') || '0');
        const r = parseFloat(node.getAttribute('r') || '0');
        // approximate circle path
        svgPath = `M ${cx - r}, ${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0`;
      } else if (nodeName === 'ellipse') {
        const cx = parseFloat(node.getAttribute('cx') || '0');
        const cy = parseFloat(node.getAttribute('cy') || '0');
        const rx = parseFloat(node.getAttribute('rx') || '0');
        const ry = parseFloat(node.getAttribute('ry') || '0');
        svgPath = `M ${cx - rx}, ${cy} a ${rx},${ry} 0 1,0 ${rx * 2},0 a ${rx},${ry} 0 1,0 ${-rx * 2},0`;
      } else if (nodeName === 'line') {
        const x1 = parseFloat(node.getAttribute('x1') || '0');
        const y1 = parseFloat(node.getAttribute('y1') || '0');
        const x2 = parseFloat(node.getAttribute('x2') || '0');
        const y2 = parseFloat(node.getAttribute('y2') || '0');
        svgPath = `M ${x1} ${y1} L ${x2} ${y2}`;
      } else if (nodeName === 'polygon' || nodeName === 'polyline') {
        const points = node.getAttribute('points') || '';
        const pairs = points.trim().split(/[\s,]+/);
        if (pairs.length >= 2) {
           svgPath = `M ${pairs[0]} ${pairs[1]}`;
           for (let i = 2; i < pairs.length; i += 2) {
              if (pairs[i] && pairs[i+1]) {
                svgPath += ` L ${pairs[i]} ${pairs[i+1]}`;
              }
           }
           if (nodeName === 'polygon') {
             svgPath += ' Z';
           }
        }
      }

      if (!svgPath) return null;

      // Note: We are currently ignoring the transform matrix when passing raw svgPaths
      // because Path2D doesn't easily accept DOMMatrix in standard contexts without addPath().
      // For a robust implementation, we would apply the transform to the canvas before drawing the path.
      // But for our simplified engine, we will pass the transform matrix as a property or embed it if possible.
      // Since our 'shapeData' currently doesn't hold 'transform', we will just store svgPath.
      // In the future, applying the transform matrix to the path string would be ideal.

      return {
        ...baseLayer,
        type: 'shape',
        shapeData: {
          type: 'path',
          svgPath: svgPath,
          fill: fill === 'none' ? undefined : fill,
          stroke: stroke === 'none' ? undefined : stroke,
          strokeWidth: strokeWidth
        }
      } as Layer;
    }

    return null;
  };

  const children = Array.from(svg.children);
  for (const child of children) {
    const parsed = await processNode(child);
    if (parsed) {
      if (Array.isArray(parsed)) {
        layers.push(...parsed);
      } else {
        layers.push(parsed);
      }
    }
  }

  // If there are multiple root items, wrap them in a group if defaultName is provided
  // But for better structure, we just return the array of layers.
  return layers;
};
