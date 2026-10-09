/**
 * Vector geometry helpers for Select > Modify (Expand / Contract / Border / Smooth).
 *
 * Selections are stored as a rect (`selectionRect`, optionally an ellipse)
 * or as freeform polygons (`lassoPaths`). These helpers operate on that
 * vector representation so modified selections stay editable.
 */

export interface SelPoint {
  x: number;
  y: number;
}

export interface SelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Normalize a rect so w/h are non-negative. */
export function normRect(r: SelRect): SelRect {
  const x = r.w >= 0 ? r.x : r.x + r.w;
  const y = r.h >= 0 ? r.y : r.y + r.h;
  return { x, y, w: Math.abs(r.w), h: Math.abs(r.h) };
}

/** Signed polygon area. Positive => counter-clockwise. */
export function signedArea(poly: SelPoint[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/**
 * Offset a polygon outward (delta > 0) or inward (delta < 0) using miter joins.
 * For strongly concave corners the miter is clamped to avoid spikes.
 */
export function offsetPolygon(poly: SelPoint[], delta: number): SelPoint[] {
  const n = poly.length;
  if (n < 3 || delta === 0) return poly.map((p) => ({ ...p }));
  const ccw = signedArea(poly) > 0;

  const edgeNormals: SelPoint[] = [];
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    // Outward normal: right of the edge direction for CCW, left for CW.
    edgeNormals.push(
      ccw ? { x: dy / len, y: -dx / len } : { x: -dy / len, y: dx / len }
    );
  }

  return poly.map((p, i) => {
    const n1 = edgeNormals[(i - 1 + n) % n];
    const n2 = edgeNormals[i];
    let mx = n1.x + n2.x;
    let my = n1.y + n2.y;
    const mLen = Math.hypot(mx, my);
    if (mLen < 1e-6) {
      mx = n2.x;
      my = n2.y;
    } else {
      mx /= mLen;
      my /= mLen;
    }
    // Miter length correction, clamped to avoid spikes on sharp corners.
    const dot = Math.max(0.5, mx * n2.x + my * n2.y);
    const m = delta / dot;
    return { x: p.x + mx * m, y: p.y + my * m };
  });
}

/** One iteration of Chaikin's corner-cutting smoothing (closed polygon). */
export function chaikin(poly: SelPoint[]): SelPoint[] {
  const n = poly.length;
  if (n < 3) return poly.map((p) => ({ ...p }));
  const out: SelPoint[] = [];
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % n];
    out.push(
      { x: 0.75 * p.x + 0.25 * q.x, y: 0.75 * p.y + 0.25 * q.y },
      { x: 0.25 * p.x + 0.75 * q.x, y: 0.25 * p.y + 0.75 * q.y }
    );
  }
  return out;
}

/** Convert a rect (or ellipse) selection to a polygon. */
export function rectToPolygon(rect: SelRect, shape: string): SelPoint[] {
  const r = normRect(rect);
  if (shape === 'ellipse') {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const rx = r.w / 2;
    const ry = r.h / 2;
    const pts: SelPoint[] = [];
    const steps = 48;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
    }
    return pts;
  }
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.h },
    { x: r.x, y: r.y + r.h },
  ];
}
