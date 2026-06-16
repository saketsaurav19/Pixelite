import type { PathSegment, SceneNode, SceneNodeTransform, TableNode } from '../types/SceneNode';
import type { Layer } from '../../store/types';
import { nanoid } from 'nanoid';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pathSegmentsToSvgPath(segments: PathSegment[]): string {
  return segments
    .map(segment => {
      switch (segment.type) {
        case 'moveTo':
          return `M ${segment.points[0].x} ${segment.points[0].y}`;
        case 'lineTo':
          return `L ${segment.points[0].x} ${segment.points[0].y}`;
        case 'bezierCurveTo':
          return `C ${segment.points.map(p => `${p.x} ${p.y}`).join(' ')}`;
        case 'closePath':
          return 'Z';
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join(' ');
}

function translatePathSegments(segments: PathSegment[], dx: number, dy: number): PathSegment[] {
  return segments.map(segment => ({
    ...segment,
    points: segment.points.map(point => ({
      x: point.x - dx,
      y: point.y - dy,
    })),
  }));
}

/** Apply a 2D affine transform to origin (0,0) to get the layer position. */
function applyTransformToPosition(
  transform: SceneNodeTransform | undefined,
  x = 0,
  y = 0
): { x: number; y: number } {
  if (!transform) return { x, y };
  return {
    x: x * transform.a + y * transform.c + transform.e,
    y: x * transform.b + y * transform.d + transform.f,
  };
}

/** Derive the rotation in degrees from an affine transform matrix. */
function transformToRotationDeg(transform: SceneNodeTransform | undefined): number {
  if (!transform) return 0;
  const angle = Math.atan2(transform.b, transform.a) * (180 / Math.PI);
  // Round to 2 decimals; ignore sub-degree floating point noise
  return Math.abs(angle) < 0.01 ? 0 : parseFloat(angle.toFixed(2));
}

// ─── Main Converter ───────────────────────────────────────────────────────────

export function convertSceneNodeToLayer(
  node: SceneNode,
  pageOffsetX = 0,
  pageOffsetY = 0
): Layer {
  const basePosition = applyTransformToPosition(node.transform, 0, 0);
  const position = {
    x: basePosition.x + pageOffsetX,
    y: basePosition.y + pageOffsetY,
  };

  switch (node.type) {
    // ── Image ─────────────────────────────────────────────────────────────
    case 'image': {
      const rotation = transformToRotationDeg(node.transform);
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
        width:  node.geometry.width,
        height: node.geometry.height,
        rotation: rotation || undefined,
      };
    }

    // ── Vector Path / Shape ────────────────────────────────────────────────
    case 'path': {
      const rotation = transformToRotationDeg(node.transform);
      const pathSegments = translatePathSegments(
        node.geometry.segments,
        node.transform?.e || 0,
        node.transform?.f || 0
      );
      return {
        id: node.id || nanoid(),
        name: node.name || 'Path',
        type: 'shape',
        visible: node.visible !== false,
        locked: node.locked === true,
        opacity: node.opacity ?? 1,
        blendMode: (node.blendMode as any) || 'source-over',
        position,
        rotation: rotation || undefined,
        shapeData: {
          type: 'path',
          svgPath: pathSegmentsToSvgPath(pathSegments),
          fill:        node.style.fillColor   || 'transparent',
          stroke:      node.style.strokeColor || 'transparent',
          strokeWidth: node.style.strokeWidth ?? 0,
          closed:      node.geometry.isClosed,
        },
      };
    }

    // ── Text ──────────────────────────────────────────────────────────────
    case 'text': {
      const geo = node.geometry;
      const rotation = geo.rotation
        ?? transformToRotationDeg(node.transform);

      return {
        id: node.id || nanoid(),
        name: node.name || 'Text',
        type: 'text',
        visible: node.visible !== false,
        locked: node.locked === true,
        opacity: geo.opacity ?? node.opacity ?? 1,
        blendMode: (node.blendMode as any) || 'source-over',
        position,
        textContent: geo.text,
        fontSize:    geo.fontSize,
        color:       geo.color || node.style?.fillColor || '#000000',
        strokeColor: geo.strokeColor || node.style?.strokeColor,
        fontFamily:  geo.fontFamily,
        fontWeight:  geo.fontWeight,
        rotation:    rotation || undefined,
        isWatermark: geo.isWatermark || undefined,
        runs:        geo.runs,
        shapedPositions: (geo as any).shapedPositions || undefined,
        fontChecksum: geo.fontChecksum,
        fontName:     geo.fontName,
      };
    }

    // ── Table ───────────────────────────────────────────────────────────────────
    case 'table': {
      const tNode = node as TableNode;
      const td = tNode.tableData;
      return {
        id: node.id || nanoid(),
        name: node.name || 'Table',
        type: 'table',
        visible: node.visible !== false,
        locked: node.locked === true,
        opacity: node.opacity ?? 1,
        blendMode: (node.blendMode as any) || 'source-over',
        position: {
          x: td.x + pageOffsetX,
          y: td.y + pageOffsetY,
        },
        width:  td.width,
        height: td.height,
        tableData: {
          x:          td.x,
          y:          td.y,
          width:      td.width,
          height:     td.height,
          rows:       td.rows,
          cols:       td.cols,
          rowHeights: td.rowHeights,
          colWidths:  td.colWidths,
          cells:      td.cells.map(c => ({
            row:        c.row,
            col:        c.col,
            x:          c.x,
            y:          c.y,
            width:      c.width,
            height:     c.height,
            text:       c.text,
            fontSize:   c.fontSize,
            fontWeight: c.fontWeight,
            fontFamily: c.fontFamily,
            color:      c.color,
            textAlign:  c.textAlign,
          })),
        },
      };
    }

    // ── Group / Page ──────────────────────────────────────────────────────
    case 'group':
    case 'page': {
      const annotations = node.type === 'page' ? node.annotations : undefined;
      return {
        id: node.id || nanoid(),
        name: node.name || (node.type === 'page' ? 'Page' : 'Group'),
        type: 'group',
        visible: node.visible !== false,
        locked: node.locked === true,
        opacity: node.opacity ?? 1,
        blendMode: (node.blendMode as any) || 'pass through',
        position,
        children: (node.children || []).map(child =>
          convertSceneNodeToLayer(child, pageOffsetX, pageOffsetY)
        ),
        collapsed: false,
        annotations: annotations?.length ? annotations : undefined,
      };
    }

    // ── Fallback ─────────────────────────────────────────────────────────
    default:
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
