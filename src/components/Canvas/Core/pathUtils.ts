import type { Point } from '../types';

export const getSvgPathData = (points: Point[], closed: boolean, smooth: boolean = false): string => {
  if (points.length < 2) return '';
  if (!smooth) {
    return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') + (closed ? ' Z' : '');
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return d + ` L ${points[1].x} ${points[1].y}` + (closed ? ' Z' : '');
  }

  for (let i = 0; i < (closed ? points.length : points.length - 1); i++) {
    const p0 = points[(i - 1 + points.length) % points.length];
    const p1 = points[i % points.length];
    const p2 = points[(i + 1) % points.length];
    const p3 = points[(i + 2) % points.length];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  if (closed) d += ' Z';
  return d;
};
