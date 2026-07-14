import { useEffect, useRef } from 'react';
import type { Layer } from '../../../store/useStore';
import type { CanvasRefs } from '../types';

const generateThumbnail = (
  layer: Layer,
  documentSize: { w: number; h: number },
  canvasRefs: CanvasRefs,
  updateLayer: (id: string, updates: Partial<Layer>) => void,
  lastContentRef: React.MutableRefObject<{ [key: string]: string }>,
  parentArtboard?: Layer
): void => {
  // If it's a group or artboard, recursively generate thumbnails for children
  if ((layer.type === 'group' || layer.type === 'artboard') && layer.children) {
    layer.children.forEach(child => {
      generateThumbnail(
        child,
        documentSize,
        canvasRefs,
        updateLayer,
        lastContentRef,
        layer.type === 'artboard' ? layer : parentArtboard
      );
    });

    // Also composite children onto the group/artboard's own thumbnail
    const refW = layer.width || documentSize.w;
    const refH = layer.height || documentSize.h;
    const aspect = refW / refH;
    const maxSize = 48;
    let thumbW, thumbH;
    if (aspect > 1) {
      thumbW = maxSize;
      thumbH = maxSize / aspect;
    } else {
      thumbH = maxSize;
      thumbW = maxSize * aspect;
    }

    const { thumbnail, ...content } = layer;
    const contentStr = JSON.stringify(content);
    if (lastContentRef.current[layer.id] !== contentStr) {
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = thumbW;
      thumbCanvas.height = thumbH;
      const thumbCtx = thumbCanvas.getContext('2d');
      if (thumbCtx) {
        if (layer.type === 'artboard') {
          thumbCtx.fillStyle = layer.backgroundTransparent ? 'transparent' : (layer.backgroundColor || '#ffffff');
          thumbCtx.fillRect(0, 0, thumbW, thumbH);
        }

        const scaleX = thumbW / refW;
        const scaleY = thumbH / refH;

        const drawChildOntoThumb = (node: Layer) => {
          if (!node.visible) return;
          if (node.type === 'group' || node.type === 'artboard') {
            if (node.children) {
              [...node.children].reverse().forEach(drawChildOntoThumb);
            }
          } else {
            const canvas = canvasRefs.current[node.id];
            if (canvas) {
              const nodeX = node.position?.x || 0;
              const nodeY = node.position?.y || 0;
              const nodeW = node.width || (canvas.width / (window.devicePixelRatio || 1));
              const nodeH = node.height || (canvas.height / (window.devicePixelRatio || 1));

              thumbCtx.drawImage(
                canvas,
                0, 0, canvas.width, canvas.height,
                nodeX * scaleX, nodeY * scaleY,
                nodeW * scaleX, nodeH * scaleY
              );
            }
          }
        };

        // Render children bottom-to-top (reverse the list order since index 0 is top)
        const childrenCopy = [...layer.children].reverse();
        childrenCopy.forEach(drawChildOntoThumb);

        updateLayer(layer.id, { thumbnail: thumbCanvas.toDataURL() });
        lastContentRef.current[layer.id] = contentStr;
      }
    }
    return;
  }

  const { thumbnail, ...content } = layer;
  const contentStr = JSON.stringify(content);
  if (lastContentRef.current[layer.id] !== contentStr) {
    const thumbCanvas = document.createElement('canvas');
    const maxSize = 48;

    if (layer.type === 'text') {
      thumbCanvas.width = maxSize;
      thumbCanvas.height = maxSize;
      const thumbCtx = thumbCanvas.getContext('2d');
      if (thumbCtx) {
        const colorStr = (layer.color || '#000000').toLowerCase();
        let isNearWhite = false;
        
        if (colorStr.includes('rgb')) {
          const match = colorStr.match(/\d+/g);
          if (match && match.length >= 3) {
            const r = parseInt(match[0]);
            const g = parseInt(match[1]);
            const b = parseInt(match[2]);
            if (r > 220 && g > 220 && b > 220) {
              isNearWhite = true;
            }
          }
        } else if (colorStr.startsWith('#')) {
          const hex = colorStr.slice(1);
          if (hex.length === 3) {
            const r = parseInt(hex[0], 16) * 17;
            const g = parseInt(hex[1], 16) * 17;
            const b = parseInt(hex[2], 16) * 17;
            if (r > 220 && g > 220 && b > 220) isNearWhite = true;
          } else if (hex.length >= 6) {
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            if (r > 220 && g > 220 && b > 220) isNearWhite = true;
          }
        } else if (colorStr === 'white' || colorStr === '#fff' || colorStr === '#ffffff') {
          isNearWhite = true;
        }

        // Background
        thumbCtx.fillStyle = isNearWhite ? '#000000' : '#ffffff';
        thumbCtx.fillRect(0, 0, maxSize, maxSize);

        // Text rendering
        thumbCtx.fillStyle = layer.color || '#000000';
        thumbCtx.font = 'bold 11px sans-serif';
        thumbCtx.textAlign = 'center';
        thumbCtx.textBaseline = 'middle';
        
        let dispText = layer.textContent || 'T';
        if (dispText.length > 5) {
          dispText = dispText.substring(0, 4) + '..';
        }
        thumbCtx.fillText(dispText, maxSize / 2, maxSize / 2);

        updateLayer(layer.id, { thumbnail: thumbCanvas.toDataURL() });
        lastContentRef.current[layer.id] = contentStr;
      }
    } else if (layer.type === 'shape') {
      thumbCanvas.width = maxSize;
      thumbCanvas.height = maxSize;
      const thumbCtx = thumbCanvas.getContext('2d');
      if (thumbCtx) {
        const fillStr = (layer.shapeData?.fill || '#000000').toLowerCase();
        let isLight = false;

        const getBrightness = (r: number, g: number, b: number) => {
          return 0.299 * r + 0.587 * g + 0.114 * b;
        };

        if (fillStr.includes('rgb')) {
          const match = fillStr.match(/\d+/g);
          if (match && match.length >= 3) {
            const r = parseInt(match[0]);
            const g = parseInt(match[1]);
            const b = parseInt(match[2]);
            const brightness = getBrightness(r, g, b);
            if (brightness > 128) isLight = true;
          }
        } else if (fillStr.startsWith('#')) {
          const hex = fillStr.slice(1);
          if (hex.length === 3) {
            const r = parseInt(hex[0], 16) * 17;
            const g = parseInt(hex[1], 16) * 17;
            const b = parseInt(hex[2], 16) * 17;
            const brightness = getBrightness(r, g, b);
            if (brightness > 128) isLight = true;
          } else if (hex.length >= 6) {
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            const brightness = getBrightness(r, g, b);
            if (brightness > 128) isLight = true;
          }
        } else if (fillStr === 'white' || fillStr === '#fff' || fillStr === '#ffffff' || fillStr === 'yellow' || fillStr === 'cyan' || fillStr === 'magenta') {
          isLight = true;
        } else if (fillStr === 'transparent' || fillStr === 'none' || fillStr === '') {
          const strokeStr = (layer.shapeData?.stroke || '#000000').toLowerCase();
          if (strokeStr.includes('rgb')) {
            const match = strokeStr.match(/\d+/g);
            if (match && match.length >= 3) {
              const r = parseInt(match[0]);
              const g = parseInt(match[1]);
              const b = parseInt(match[2]);
              const brightness = getBrightness(r, g, b);
              if (brightness > 128) isLight = true;
            }
          } else if (strokeStr.startsWith('#')) {
            const hex = strokeStr.slice(1);
            if (hex.length === 3) {
              const r = parseInt(hex[0], 16) * 17;
              const g = parseInt(hex[1], 16) * 17;
              const b = parseInt(hex[2], 16) * 17;
              const brightness = getBrightness(r, g, b);
              if (brightness > 128) isLight = true;
            } else if (hex.length >= 6) {
              const r = parseInt(hex.slice(0, 2), 16);
              const g = parseInt(hex.slice(2, 4), 16);
              const b = parseInt(hex.slice(4, 6), 16);
              const brightness = getBrightness(r, g, b);
              if (brightness > 128) isLight = true;
            }
          } else if (strokeStr === 'white' || strokeStr === '#fff' || strokeStr === '#ffffff') {
            isLight = true;
          }
        }

        thumbCtx.fillStyle = isLight ? '#000000' : '#ffffff';
        thumbCtx.fillRect(0, 0, maxSize, maxSize);

        const canvas = canvasRefs.current[layer.id];
        if (canvas) {
          const aspect = canvas.width / canvas.height;
          let drawW, drawH;
          if (aspect > 1) {
            drawW = maxSize;
            drawH = maxSize / aspect;
          } else {
            drawH = maxSize;
            drawW = maxSize * aspect;
          }
          const drawX = (maxSize - drawW) / 2;
          const drawY = (maxSize - drawH) / 2;

          thumbCtx.drawImage(
            canvas,
            0, 0, canvas.width, canvas.height,
            drawX, drawY, drawW, drawH
          );
        }

        updateLayer(layer.id, { thumbnail: thumbCanvas.toDataURL() });
        lastContentRef.current[layer.id] = contentStr;
      }
    } else {
      const canvas = canvasRefs.current[layer.id];
      if (canvas) {
        const refW = parentArtboard ? (parentArtboard.width || documentSize.w) : documentSize.w;
        const refH = parentArtboard ? (parentArtboard.height || documentSize.h) : documentSize.h;
        const aspect = refW / refH;

        let thumbW, thumbH;
        if (aspect > 1) {
          thumbW = maxSize;
          thumbH = maxSize / aspect;
        } else {
          thumbH = maxSize;
          thumbW = maxSize * aspect;
        }

        thumbCanvas.width = thumbW;
        thumbCanvas.height = thumbH;
        const thumbCtx = thumbCanvas.getContext('2d');
        if (thumbCtx) {
          const scaleX = thumbW / refW;
          const scaleY = thumbH / refH;
          const layerW = layer.width || (canvas.width / (window.devicePixelRatio || 1));
          const layerH = layer.height || (canvas.height / (window.devicePixelRatio || 1));

          thumbCtx.drawImage(
            canvas,
            0, 0, canvas.width, canvas.height,
            layer.position.x * scaleX, layer.position.y * scaleY,
            layerW * scaleX, layerH * scaleY
          );
          updateLayer(layer.id, { thumbnail: thumbCanvas.toDataURL() });
          lastContentRef.current[layer.id] = contentStr;
        }
      }
    }
  }
};

export const useThumbnailGeneration = (
  layers: Layer[],
  documentSize: { w: number, h: number },
  canvasRefs: CanvasRefs,
  updateLayer: (id: string, updates: Partial<Layer>) => void
) => {
  const lastContentRef = useRef<{ [key: string]: string }>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      layers.forEach(layer => {
        generateThumbnail(layer, documentSize, canvasRefs, updateLayer, lastContentRef);
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [layers, updateLayer, documentSize]);
};
