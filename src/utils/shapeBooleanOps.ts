// shapeBooleanOps — boolean operations on vector shape layers.
//
// Adapts the same pixel-mask technique the selection tool uses
// (`selectionBooleanOps.ts`) to the shape-layer world: rasterize each shape
// into an off-screen 2D canvas, apply the boolean via
// `globalCompositeOperation`, then extract the outline with the shared
// `tracePixelMaskBoundary` helper.
//
// Inputs are *already in document coordinates* (i.e. layer.position has been
// folded in by the caller). The output polygon is also in document
// coordinates, with the bounding box of the result so the caller can place
// the new shape layer at the right `position`.

import type { Point } from '../components/Canvas/types';
import { tracePixelMaskBoundary } from './pixelMaskBoundary';

export type BooleanOp = 'union' | 'subtract' | 'intersect' | 'exclude';

export interface ShapeForOp {
  shapeData: {
    type: 'rect' | 'path' | 'ellipse';
    w?: number; h?: number;
    points?: { x: number; y: number }[];
    svgPath?: string;
    fillRule?: 'nonzero' | 'evenodd';
    smooth?: boolean;
    closed?: boolean;
  };
  position: { x: number; y: number };
}

export interface CombinedShape {
  /** Polygon outlines in document coordinates (one subpath each). */
  polygons: Point[][];
  /** Tight bounding box of all polygons in document coordinates. */
  bbox: { x: number; y: number; w: number; h: number };
}

// ---------- Shape → canvas path ----------

// Trace a single shape (already in document coords) into the given canvas
// context at the given offset. Each shape kind has its own draw routine so
// we can paint into the mask canvas in the same way the renderer would.
const drawShape = (
  ctx: CanvasRenderingContext2D,
  shape: ShapeForOp,
  offsetX: number,
  offsetY: number
) => {
  const sd = shape.shapeData;
  ctx.save();
  ctx.translate(shape.position.x - offsetX, shape.position.y - offsetY);
  ctx.beginPath();

  if (sd.type === 'rect' || !sd.type) {
    const w = sd.w ?? 100;
    const h = sd.h ?? 100;
    ctx.rect(0, 0, w, h);
  } else if (sd.type === 'ellipse') {
    const w = sd.w ?? 100;
    const h = sd.h ?? 100;
    ctx.ellipse(w / 2, h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
  } else if (sd.type === 'path' && sd.svgPath) {
    // Reuse the renderer's path. The shape's path is defined in shape-local
    // coords; the translate above moves it to document space.
    const p = new Path2D(sd.svgPath);
    const fillRule = sd.fillRule === 'evenodd' ? 'evenodd' : 'nonzero';
    ctx.fill(p, fillRule as CanvasFillRule);
    ctx.restore();
    return;
  } else if (sd.type === 'path' && sd.points && sd.points.length > 0) {
    if (sd.smooth && sd.points.length >= 3) {
      ctx.moveTo(sd.points[0].x, sd.points[0].y);
      const len = sd.points.length;
      for (let i = 0; i < (sd.closed ? len : len - 1); i++) {
        const p1 = sd.points[i % len];
        const p2 = sd.points[(i + 1) % len];
        const p0 = sd.points[(i - 1 + len) % len];
        const p3 = sd.points[(i + 2) % len];
        const cp1x = (p1 as any).handleOut?.x ?? p1.x + (p2.x - p0.x) / 6;
        const cp1y = (p1 as any).handleOut?.y ?? p1.y + (p2.y - p0.y) / 6;
        const cp2x = (p2 as any).handleIn?.x ?? p2.x - (p3.x - p1.x) / 6;
        const cp2y = (p2 as any).handleIn?.y ?? p2.y - (p3.y - p1.y) / 6;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }
    } else {
      ctx.moveTo(sd.points[0].x, sd.points[0].y);
      sd.points.forEach((p) => ctx.lineTo(p.x, p.y));
    }
    if (sd.closed || sd.smooth) ctx.closePath();
  } else {
    // Fallback: empty 1×1 rect, so we never emit a zero-size canvas.
    ctx.rect(0, 0, 1, 1);
  }

  ctx.fill();
  ctx.restore();
};

// ---------- Bounding box ----------

const computeShapeBBox = (shape: ShapeForOp) => {
  const sd = shape.shapeData;
  if (sd.type === 'rect' || !sd.type) {
    const w = sd.w ?? 100;
    const h = sd.h ?? 100;
    return {
      minX: shape.position.x,
      minY: shape.position.y,
      maxX: shape.position.x + w,
      maxY: shape.position.y + h,
    };
  }
  if (sd.type === 'ellipse') {
    const w = sd.w ?? 100;
    const h = sd.h ?? 100;
    return {
      minX: shape.position.x,
      minY: shape.position.y,
      maxX: shape.position.x + Math.abs(w),
      maxY: shape.position.y + Math.abs(h),
    };
  }
  if (sd.type === 'path' && sd.svgPath) {
    // Parse the M/L/Q/C/Z commands and project the extents. Bézier extrema
    // are not the same as the on-curve points, so we additionally check
    // control points (good enough for axis-aligned previews).
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const re = /([MLCQZ])\s*([^MLCQZ]*)/g;
    let m: RegExpExecArray | null;
    let cx = 0, cy = 0; // current point
    const accum = (x: number, y: number) => {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    };
    while ((m = re.exec(sd.svgPath)) !== null) {
      const cmd = m[1];
      const args = m[2].trim().split(/[\s,]+/).map(parseFloat);
      if (cmd === 'M' || cmd === 'L') {
        cx = args[0]; cy = args[1];
        accum(cx, cy);
      } else if (cmd === 'Q') {
        accum(args[0], args[1]); accum(args[2], args[3]);
        cx = args[2]; cy = args[3];
      } else if (cmd === 'C') {
        accum(args[0], args[1]); accum(args[2], args[3]); accum(args[4], args[5]);
        cx = args[4]; cy = args[5];
      } else if (cmd === 'Z') {
        // no-op
      }
    }
    if (!isFinite(minX)) {
      return { minX: shape.position.x, minY: shape.position.y, maxX: shape.position.x, maxY: shape.position.y };
    }
    return {
      minX: minX + shape.position.x,
      minY: minY + shape.position.y,
      maxX: maxX + shape.position.x,
      maxY: maxY + shape.position.y,
    };
  }
  if (sd.type === 'path' && sd.points && sd.points.length) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    sd.points.forEach((p) => {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });
    return {
      minX: minX + shape.position.x,
      minY: minY + shape.position.y,
      maxX: maxX + shape.position.x,
      maxY: maxY + shape.position.y,
    };
  }
  return { minX: shape.position.x, minY: shape.position.y, maxX: shape.position.x, maxY: shape.position.y };
};

// ---------- Public: combineShapes ----------

export const combineShapes = (shapes: ShapeForOp[], op: BooleanOp): CombinedShape | null => {
  if (shapes.length < 2) return null;

  // Compute the union bbox for the OUTPUT — same in all ops so we can size
  // the working canvas once.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  shapes.forEach((s) => {
    const b = computeShapeBBox(s);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  });
  if (!isFinite(minX)) return null;
  const pad = 2;
  const width = Math.max(1, Math.round(maxX - minX + pad * 2));
  const height = Math.max(1, Math.round(maxY - minY + pad * 2));
  const offsetX = minX - pad;
  const offsetY = minY - pad;

  // Build a fresh canvas for each op, then compose.
  const buildCanvas = (): CanvasRenderingContext2D | null => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    return ctx;
  };

  let mask: Uint8Array | null = null;
  let usedOffsetX = offsetX;
  let usedOffsetY = offsetY;

  if (op === 'union') {
    const ctx = buildCanvas();
    if (!ctx) return null;
    ctx.fillStyle = '#000000';
    shapes.forEach((s) => drawShape(ctx, s, offsetX, offsetY));
    const data = ctx.getImageData(0, 0, width, height).data;
    mask = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) mask[i] = data[i * 4 + 3] > 0 ? 1 : 0;
  } else if (op === 'subtract') {
    // Bottom shape is the canvas; each subsequent shape is erased on top.
    const ctx = buildCanvas();
    if (!ctx) return null;
    ctx.fillStyle = '#000000';
    drawShape(ctx, shapes[0], offsetX, offsetY);
    for (let i = 1; i < shapes.length; i++) {
      ctx.globalCompositeOperation = 'destination-out';
      drawShape(ctx, shapes[i], offsetX, offsetY);
    }
    ctx.globalCompositeOperation = 'source-over';
    const data = ctx.getImageData(0, 0, width, height).data;
    mask = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) mask[i] = data[i * 4 + 3] > 0 ? 1 : 0;
  } else if (op === 'intersect') {
    // Intersect = paint first shape, then mask each subsequent shape with
    // 'destination-in' so only the overlap survives.
    const ctx = buildCanvas();
    if (!ctx) return null;
    ctx.fillStyle = '#000000';
    drawShape(ctx, shapes[0], offsetX, offsetY);
    for (let i = 1; i < shapes.length; i++) {
      ctx.globalCompositeOperation = 'destination-in';
      drawShape(ctx, shapes[i], offsetX, offsetY);
    }
    ctx.globalCompositeOperation = 'source-over';
    const data = ctx.getImageData(0, 0, width, height).data;
    mask = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) mask[i] = data[i * 4 + 3] > 1 ? 1 : 0;
  } else if (op === 'exclude') {
    // exclude(A, B) = (A∪B) − (A∩B). Two passes:
    //   1. union: paint all shapes with 'source-over' into bufUnion
    //   2. intersect: paint first, then mask each with 'destination-in' into bufIntersect
    //   3. combine: paint union into bufOut, then erase intersect with 'destination-out'
    const ctx = buildCanvas();
    if (!ctx) return null;
    ctx.fillStyle = '#000000';
    // Pass 1: union.
    shapes.forEach((s) => drawShape(ctx, s, offsetX, offsetY));
    const unionData = ctx.getImageData(0, 0, width, height).data;
    const unionMask = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) unionMask[i] = unionData[i * 4 + 3] > 0 ? 1 : 0;
    // Pass 2: intersect.
    const ctx2 = buildCanvas();
    if (!ctx2) return null;
    ctx2.fillStyle = '#000000';
    drawShape(ctx2, shapes[0], offsetX, offsetY);
    for (let i = 1; i < shapes.length; i++) {
      ctx2.globalCompositeOperation = 'destination-in';
      drawShape(ctx2, shapes[i], offsetX, offsetY);
    }
    ctx2.globalCompositeOperation = 'source-over';
    const interData = ctx2.getImageData(0, 0, width, height).data;
    const interMask = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) interMask[i] = interData[i * 4 + 3] > 0 ? 1 : 0;
    // Pass 3: union - intersect.
    const ctx3 = buildCanvas();
    if (!ctx3) return null;
    ctx3.fillStyle = '#000000';
    // Paint union directly as a mask: write to a temp canvas at full opacity
    // wherever unionMask is set.
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = width;
    tmpCanvas.height = height;
    const tmpCtx = tmpCanvas.getContext('2d');
    if (!tmpCtx) return null;
    const imgData = tmpCtx.createImageData(width, height);
    for (let i = 0; i < width * height; i++) {
      const v = unionMask[i] ? 255 : 0;
      imgData.data[i * 4 + 0] = v;
      imgData.data[i * 4 + 1] = v;
      imgData.data[i * 4 + 2] = v;
      imgData.data[i * 4 + 3] = v;
    }
    tmpCtx.putImageData(imgData, 0, 0);
    ctx3.drawImage(tmpCanvas, 0, 0);
    // Erase the intersection with 'destination-out' by writing a mask to
    // another tmp canvas and drawing it.
    const tmpCanvas2 = document.createElement('canvas');
    tmpCanvas2.width = width;
    tmpCanvas2.height = height;
    const tmpCtx2 = tmpCanvas2.getContext('2d');
    if (!tmpCtx2) return null;
    const imgData2 = tmpCtx2.createImageData(width, height);
    for (let i = 0; i < width * height; i++) {
      const v = interMask[i] ? 255 : 0;
      imgData2.data[i * 4 + 0] = v;
      imgData2.data[i * 4 + 1] = v;
      imgData2.data[i * 4 + 2] = v;
      imgData2.data[i * 4 + 3] = v;
    }
    tmpCtx2.putImageData(imgData2, 0, 0);
    ctx3.globalCompositeOperation = 'destination-out';
    ctx3.drawImage(tmpCanvas2, 0, 0);
    ctx3.globalCompositeOperation = 'source-over';
    const data = ctx3.getImageData(0, 0, width, height).data;
    mask = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) mask[i] = data[i * 4 + 3] > 0 ? 1 : 0;
  }

  if (!mask) return null;
  const boundaries = tracePixelMaskBoundary(mask, width, height);
  if (!boundaries.length || boundaries.every((b) => b.length < 3)) return null;

  // Translate each connected component's boundary back into document coordinates.
  const polygons: Point[][] = boundaries
    .filter((b) => b.length >= 3)
    .map((b) => b.map((p) => ({ x: p.x + usedOffsetX, y: p.y + usedOffsetY })));

  // Compute the bbox from the actual polygon (more accurate than the input bbox
  // because exclude may have carved out a chunk).
  let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;
  polygons.forEach((poly) => {
    poly.forEach((p) => {
      if (p.x < pMinX) pMinX = p.x;
      if (p.y < pMinY) pMinY = p.y;
      if (p.x > pMaxX) pMaxX = p.x;
      if (p.y > pMaxY) pMaxY = p.y;
    });
  });
  if (!isFinite(pMinX)) return null;

  return {
    polygons,
    bbox: { x: pMinX, y: pMinY, w: pMaxX - pMinX, h: pMaxY - pMinY },
  };
};

// ---------- Polygon → SVG path string ----------

// Build a path "d" attribute from one or more closed polylines. The renderer
// applies evenodd fill so the inner rings (holes) work without reversing
// winding.
export const polygonsToSvgPath = (polygons: Point[][]): string => {
  let d = '';
  polygons.forEach((poly) => {
    if (poly.length < 3) return;
    d += `M ${poly[0].x.toFixed(2)} ${poly[0].y.toFixed(2)} `;
    for (let i = 1; i < poly.length; i++) {
      d += `L ${poly[i].x.toFixed(2)} ${poly[i].y.toFixed(2)} `;
    }
    d += 'Z ';
  });
  return d.trim();
};

// ---------- Public: build a "shape layer" from a CombinedShape result ----------

export const buildCombinedShapeLayer = (
  polygons: Point[][],
  bbox: { x: number; y: number; w: number; h: number },
  baseShape: ShapeForOp
) => {
  // The polygon points are in document space; subtract the bbox origin so the
  // resulting layer's `position` carries the offset and the path is local.
  const localPolys: Point[][] = polygons.map((poly) =>
    poly.map((p) => ({ x: p.x - bbox.x, y: p.y - bbox.y }))
  );
  const svgPath = polygonsToSvgPath(localPolys);
  return {
    svgPath,
    shapeData: {
      type: 'path' as const,
      svgPath,
      fill: '#000000', // placeholder; the slice action overwrites with the base shape's fill.
      stroke: baseShape.shapeData.type === 'path' ? 'transparent' : 'transparent',
      strokeWidth: 0,
      fillRule: 'evenodd' as const,
    },
  };
};
