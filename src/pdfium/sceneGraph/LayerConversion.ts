import type { PathSegment, SceneNode, SceneNodeTransform } from '../types/SceneNode';
import type { Layer } from '../../store/types';
import { nanoid } from 'nanoid';


function pathSegmentsToSvgPath(segments: PathSegment[]): string {
  return segments.map((segment) => {
    switch (segment.type) {
      case 'moveTo':
        return `M ${segment.points[0].x} ${segment.points[0].y}`;
      case 'lineTo':
        return `L ${segment.points[0].x} ${segment.points[0].y}`;
      case 'bezierCurveTo':
        return `C ${segment.points.map((point) => `${point.x} ${point.y}`).join(' ')}`;
      case 'closePath':
        return 'Z';
      default:
        return '';
    }
  }).filter(Boolean).join(' ');
}

function applyTransformToPosition(transform: SceneNodeTransform | undefined, x: number, y: number): { x: number, y: number } {
  if (!transform) return { x, y };
  return {
    x: x * transform.a + y * transform.c + transform.e,
    y: x * transform.b + y * transform.d + transform.f,
  };
}

export function convertSceneNodeToLayer(node: SceneNode, pageOffsetX: number = 0, pageOffsetY: number = 0): Layer {
  const basePosition = applyTransformToPosition(node.transform, 0, 0);
  const position = {
    x: basePosition.x + pageOffsetX,
    y: basePosition.y + pageOffsetY,
  };

  switch (node.type) {
    case 'image':
      return {
        id: node.id || nanoid(),
        name: node.name || 'Image',
        type: 'image',
        visible: node.visible !== false,
        locked: node.locked === true,
        opacity: node.opacity ?? 1,
        blendMode: (node.blendMode as any) || 'source-over',
        position,
        dataUrl: node.geometry.dataUrl,
      };

    case 'path':
      // Basic conversion for paths. Ideally, path segments get mapped to SVG path data or our shape data.
      return {
        id: node.id || nanoid(),
        name: node.name || 'Path',
        type: 'shape',
        visible: node.visible !== false,
        locked: node.locked === true,
        opacity: node.opacity ?? 1,
        blendMode: (node.blendMode as any) || 'source-over',
        position,
        shapeData: {
          type: 'path',
          svgPath: pathSegmentsToSvgPath(node.geometry.segments),
          fill: node.style.fillColor || 'transparent',
          stroke: node.style.strokeColor || 'transparent',
          strokeWidth: node.style.strokeWidth || 0,
          closed: node.geometry.isClosed,
        }
      };

    case 'text':
      return {
        id: node.id || nanoid(),
        name: node.name || 'Text',
        type: 'text',
        visible: node.visible !== false,
        locked: node.locked === true,
        opacity: node.opacity ?? 1,
        blendMode: (node.blendMode as any) || 'source-over',
        position,
        textContent: node.geometry.text,
        fontSize: node.geometry.fontSize,
        color: node.style.fillColor || '#000000',
      };

    case 'group':
    case 'page':
      return {
        id: node.id || nanoid(),
        name: node.name || (node.type === 'page' ? 'Page' : 'Group'),
        type: 'group',
        visible: node.visible !== false,
        locked: node.locked === true,
        opacity: node.opacity ?? 1,
        blendMode: (node.blendMode as any) || 'pass through',
        position,
        children: (node.children || []).map(child => convertSceneNodeToLayer(child, pageOffsetX, pageOffsetY)),
        collapsed: false,
      };

    default:
      // Fallback
      return {
        id: node.id || nanoid(),
        name: node.name || 'Layer',
        type: 'group',
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'source-over',
        position,
        children: [],
      };
  }
}
