import type { SceneNode, SceneNodeTransform } from '../types/SceneNode';
import type { Layer } from '../../store/types';
import { nanoid } from 'nanoid';

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
          type: 'custom',
          pathSegments: node.geometry.segments, // Needs mapping if Pixelite supports arbitrary path rendering
          fill: node.style.fillColor || 'transparent',
          stroke: node.style.strokeColor || 'transparent',
          strokeWidth: node.style.strokeWidth || 0,
        }
      } as any;

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
        textData: {
          text: node.geometry.text,
          fontSize: node.geometry.fontSize,
          fontFamily: node.geometry.fontFamily || 'Arial',
          color: node.style.fillColor || '#000000',
        }
      } as any;

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
