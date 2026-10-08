import type { Point } from '../types';

interface VectorPoint extends Point {
  handleIn?: { x: number; y: number };
  handleOut?: { x: number; y: number };
}

export const getSvgPathData = (points: VectorPoint[], closed: boolean, smooth: boolean = false): string => {
  if (points.length < 2) return '';
  if (!smooth) {
    return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') + (closed ? ' Z' : '');
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    const p1 = points[0];
    const p2 = points[1];
    const cp1x = (p1.handleOut?.x ?? p1.x);
    const cp1y = (p1.handleOut?.y ?? p1.y);
    const cp2x = (p2.handleIn?.x ?? p2.x);
    const cp2y = (p2.handleIn?.y ?? p2.y);
    return d + ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}` + (closed ? ' Z' : '');
  }

  const len = points.length;
  for (let i = 0; i < (closed ? len : len - 1); i++) {
    const p1 = points[i % len];
    const p2 = points[(i + 1) % len];

    const p0 = points[(i - 1 + len) % len];
    const p3 = points[(i + 2) % len];
    const cp1x = p1.handleOut?.x ?? p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.handleOut?.y ?? p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.handleIn?.x ?? p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.handleIn?.y ?? p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  if (closed) d += ' Z';
  return d;
};

export const traceVectorPath = (ctx: CanvasRenderingContext2D, path: { points: VectorPoint[]; closed: boolean; smooth?: boolean }): void => {
  const points = path.points;
  if (!points || points.length === 0) return;

  ctx.moveTo(points[0].x, points[0].y);
  if (path.smooth && points.length >= 3) {
    const len = points.length;
    for (let i = 0; i < (path.closed ? len : len - 1); i++) {
      const p1 = points[i % len];
      const p2 = points[(i + 1) % len];
      const p0 = points[(i - 1 + len) % len];
      const p3 = points[(i + 2) % len];

      const cp1x = p1.handleOut?.x ?? p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.handleOut?.y ?? p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.handleIn?.x ?? p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.handleIn?.y ?? p2.y - (p3.y - p1.y) / 6;

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
  } else {
    for (let j = 1; j < points.length; j++) {
      ctx.lineTo(points[j].x, points[j].y);
    }
  }

  if (path.closed) ctx.closePath();
};
