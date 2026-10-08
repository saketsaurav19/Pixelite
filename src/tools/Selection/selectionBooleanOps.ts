import type { Point } from '../../components/Canvas/types';
import { tracePixelMaskBoundary } from '../../utils/pixelMaskBoundary';

const drawPath = (ctx: CanvasRenderingContext2D, path: Point[], offsetX: number, offsetY: number) => {
  if (path.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(path[0].x - offsetX, path[0].y - offsetY);
  path.forEach((p) => ctx.lineTo(p.x - offsetX, p.y - offsetY));
  ctx.closePath();
  ctx.fill();
};

export const computeSelectionBooleanOp = (
  existing: Point[][],
  newPath: Point[],
  op: 'add' | 'subtract' | 'intersect' | 'unite'
): Point[][] => {
  if (!newPath || newPath.length < 3) {
    return existing;
  }

  const allPaths = [...existing, newPath];
  const bounds = allPaths.reduce<{ minX: number; minY: number; maxX: number; maxY: number }>(
    (acc, path) => {
      path.forEach((p) => {
        acc.minX = Math.min(acc.minX, p.x);
        acc.minY = Math.min(acc.minY, p.y);
        acc.maxX = Math.max(acc.maxX, p.x);
        acc.maxY = Math.max(acc.maxY, p.y);
      });
      return acc;
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  if (!isFinite(bounds.minX)) return [];

  const pad = 2;
  const w = Math.max(1, Math.round(bounds.maxX - bounds.minX + pad * 2));
  const h = Math.max(1, Math.round(bounds.maxY - bounds.minY + pad * 2));
  const offsetX = bounds.minX - pad;
  const offsetY = bounds.minY - pad;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return existing;

  ctx.fillStyle = '#000000';
  existing.forEach((path) => drawPath(ctx, path, offsetX, offsetY));

  if (op === 'add' || op === 'unite') {
    drawPath(ctx, newPath, offsetX, offsetY);
  } else if (op === 'subtract') {
    ctx.globalCompositeOperation = 'destination-out';
    drawPath(ctx, newPath, offsetX, offsetY);
  } else if (op === 'intersect') {
    ctx.globalCompositeOperation = 'destination-in';
    drawPath(ctx, newPath, offsetX, offsetY);
  }

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    mask[i] = data[i * 4 + 3] > 0 ? 1 : 0;
  }

  const boundaries = tracePixelMaskBoundary(mask, w, h);
  if (!boundaries.length || boundaries.every((b) => b.length < 3)) return existing;

  return boundaries
    .filter((b) => b.length >= 3)
    .map((b) => b.map((p) => ({ x: p.x + offsetX, y: p.y + offsetY })));
};
