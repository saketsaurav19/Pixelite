import type { PathNode, PathSegment, Point } from '../../types/SceneNode';
import type { GraphicsStateSnapshot } from '../../parser/GraphicsState';
import { nanoid } from 'nanoid';

export class VectorEngine {
  private currentPath: PathSegment[] = [];
  private currentPosition: Point = { x: 0, y: 0 };
  private pageHeight: number;

  constructor(pageHeight: number) {
    this.pageHeight = pageHeight;
  }

  moveTo(x: number, y: number) {
    this.currentPosition = { x, y: this.pageHeight - y };
    this.currentPath.push({ type: 'moveTo', points: [{ ...this.currentPosition }] });
  }

  lineTo(x: number, y: number) {
    this.currentPosition = { x, y: this.pageHeight - y };
    this.currentPath.push({ type: 'lineTo', points: [{ ...this.currentPosition }] });
  }

  bezierCurveTo(
    cp1x: number, cp1y: number,
    cp2x: number, cp2y: number,
    x: number,   y: number
  ) {
    const p1 = { x: cp1x, y: this.pageHeight - cp1y };
    const p2 = { x: cp2x, y: this.pageHeight - cp2y };
    const p3 = { x,       y: this.pageHeight - y };
    this.currentPosition = p3;
    this.currentPath.push({ type: 'bezierCurveTo', points: [p1, p2, p3] });
  }

  closePath() {
    this.currentPath.push({ type: 'closePath', points: [] });
  }

  /**
   * Create a PathNode from the accumulated segments, using the current
   * GraphicsStateSnapshot for fill color, stroke color, line width, opacity
   * and blend mode. Falls back to safe defaults if state is not provided.
   */
  createPathNode(
    isStroke: boolean,
    isFill: boolean,
    state?: GraphicsStateSnapshot | null
  ): PathNode | null {
    if (this.currentPath.length === 0) return null;

    const isClosed = this.currentPath.some(s => s.type === 'closePath');

    // Bounding box for the path — used to set the transform e/f (position)
    const allPoints = this.currentPath.flatMap(seg => seg.points);
    const xs = allPoints.map(p => p.x);
    const ys = allPoints.map(p => p.y);
    const minX = xs.length ? Math.min(...xs) : 0;
    const minY = ys.length ? Math.min(...ys) : 0;

    // Read live colors from the graphics state
    const fillColor   = isFill   ? (state?.fillColor   ?? '#000000') : 'transparent';
    const strokeColor = isStroke ? (state?.strokeColor ?? '#000000') : 'transparent';
    const strokeWidth = isStroke ? (state?.lineWidth   ?? 1)        : 0;
    const fillOpacity   = state?.fillOpacity   ?? 1;
    const strokeOpacity = state?.strokeOpacity ?? 1;
    const opacity   = Math.min(fillOpacity, strokeOpacity);
    const blendMode = state?.blendMode ?? 'source-over';

    const node: PathNode = {
      id: nanoid(),
      name: 'PDF Vector Path',
      type: 'path',
      transform: { a: 1, b: 0, c: 0, d: 1, e: minX, f: minY },
      opacity,
      blendMode,
      visible: true,
      locked: true,
      geometry: {
        segments: [...this.currentPath],
        isClosed,
      },
      style: {
        fillColor,
        strokeColor,
        strokeWidth,
        opacity: fillOpacity,
        strokeOpacity,
        blendMode,
        lineCap: state?.lineCap,
        lineJoin: state?.lineJoin,
        miterLimit: state?.miterLimit,
        lineDashPattern: state?.lineDashPattern,
        lineDashPhase: state?.lineDashPhase,
      },
    };

    // Reset path after creation so next path starts clean
    this.currentPath = [];
    return node;
  }

  /** Discard the current path without emitting a node (for clip paths / n operator) */
  discardPath() {
    this.currentPath = [];
  }
}
