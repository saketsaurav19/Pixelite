import type { PathNode, PathSegment, Point } from '../../types/SceneNode';
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
    this.currentPath.push({ type: 'moveTo', points: [this.currentPosition] });
  }

  lineTo(x: number, y: number) {
    this.currentPosition = { x, y: this.pageHeight - y };
    this.currentPath.push({ type: 'lineTo', points: [this.currentPosition] });
  }

  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) {
      const p1 = { x: cp1x, y: this.pageHeight - cp1y };
      const p2 = { x: cp2x, y: this.pageHeight - cp2y };
      const p3 = { x, y: this.pageHeight - y };
      this.currentPosition = p3;
      this.currentPath.push({ type: 'bezierCurveTo', points: [p1, p2, p3] });
  }

  closePath() {
      this.currentPath.push({ type: 'closePath', points: [] });
  }

  createPathNode(isStroke: boolean, isFill: boolean): PathNode | null {
    if (this.currentPath.length === 0) return null;

    const isClosed = this.currentPath.some(s => s.type === 'closePath');

    const node: PathNode = {
      id: nanoid(),
      name: 'PDF Vector Path',
      type: 'path',
      transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      opacity: 1,
      blendMode: 'source-over',
      visible: true,
      locked: true,
      geometry: {
        segments: [...this.currentPath],
        isClosed
      },
      style: {
        fillColor: isFill ? '#000000' : 'transparent', // Defaulting to black
        strokeColor: isStroke ? '#000000' : 'transparent', // Defaulting to black
        strokeWidth: isStroke ? 1 : 0
      }
    };

    // Reset path after creation
    this.currentPath = [];
    return node;
  }
}
