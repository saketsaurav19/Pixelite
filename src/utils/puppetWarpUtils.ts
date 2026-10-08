export type PuppetWarpMode = 'rigid' | 'normal' | 'distort';

export interface PuppetMesh {
  restPoints: { x: number; y: number }[];
  triangles: number[];
  gridW: number;
  gridH: number;
}

// ---------------------------------------------------------------------------
// Bowyer-Watson Delaunay triangulation helpers
// ---------------------------------------------------------------------------

interface Pt { x: number; y: number; }
interface Tri { a: number; b: number; c: number; }

function circumcircle(pts: Pt[], a: number, b: number, c: number): { cx: number; cy: number; r2: number } {
  const ax = pts[a].x, ay = pts[a].y;
  const bx = pts[b].x, by = pts[b].y;
  const cx = pts[c].x, cy = pts[c].y;

  const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(D) < 1e-10) return { cx: 0, cy: 0, r2: Infinity };

  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / D;
  const r2 = (ax - ux) ** 2 + (ay - uy) ** 2;
  return { cx: ux, cy: uy, r2 };
}

function bowyer(pts: Pt[]): Tri[] {
  const n = pts.length;
  // Super-triangle that contains all points
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const dx = (maxX - minX) * 3, dy = (maxY - minY) * 3;
  const superPts: Pt[] = [
    ...pts,
    { x: minX - dx,     y: minY - dy * 2 },
    { x: minX + dx / 2, y: maxY + dy * 3  },
    { x: maxX + dx,     y: minY - dy * 2  },
  ];
  const sa = n, sb = n + 1, sc = n + 2;

  let triangles: Tri[] = [{ a: sa, b: sb, c: sc }];

  for (let i = 0; i < n; i++) {
    const px = superPts[i].x, py = superPts[i].y;
    const badTris: Tri[] = [];

    for (const t of triangles) {
      const cc = circumcircle(superPts, t.a, t.b, t.c);
      if ((px - cc.cx) ** 2 + (py - cc.cy) ** 2 < cc.r2 - 1e-10) {
        badTris.push(t);
      }
    }

    // Find boundary polygon (edges not shared by two bad triangles)
    const edgeCount = new Map<string, number>();
    const edgeStore = new Map<string, [number, number]>();
    for (const t of badTris) {
      for (const [e0, e1] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]] as [number, number][]) {
        const key = e0 < e1 ? `${e0}_${e1}` : `${e1}_${e0}`;
        edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
        edgeStore.set(key, [e0, e1]);
      }
    }

    // Remove bad triangles
    triangles = triangles.filter(t => !badTris.includes(t));

    // Re-triangulate with boundary edges
    for (const [key, cnt] of edgeCount) {
      if (cnt === 1) {
        const [e0, e1] = edgeStore.get(key)!;
        triangles.push({ a: e0, b: e1, c: i });
      }
    }
  }

  // Remove triangles that share a vertex with the super-triangle
  return triangles.filter(t => t.a < n && t.b < n && t.c < n);
}

/**
 * Creates an organic Delaunay-triangulated mesh over specified dimensions.
 * density controls point count (3 = sparse, 15 = dense).
 */
export function createPuppetMesh(width: number, height: number, density: number = 5): PuppetMesh {
  const w = Math.max(10, width);
  const h = Math.max(10, height);

  // density 1..15 -> target point count (excluding border anchors)
  const clampedDensity = Math.max(1, Math.min(15, Math.round(density)));
  const targetPoints = Math.round(20 + clampedDensity * clampedDensity * 2.5);

  // Jittered grid: lay out points on a slightly randomised grid
  // Use a seeded-ish approach for stable layout (same density = same mesh)
  const pts: Pt[] = [];

  // Always add corners and edge midpoints for a stable boundary
  const borderPts: Pt[] = [
    { x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h },
    { x: w / 2, y: 0 }, { x: w, y: h / 2 }, { x: w / 2, y: h }, { x: 0, y: h / 2 },
  ];
  pts.push(...borderPts);

  // Compute grid cell size from target interior points
  const aspect = w / h;
  const cols = Math.max(2, Math.round(Math.sqrt(targetPoints * aspect)));
  const rows = Math.max(2, Math.round(Math.sqrt(targetPoints / aspect)));
  const cellW = w / cols;
  const cellH = h / rows;

  // Jitter amount: up to 38% of cell size, using a deterministic pseudo-random sequence
  const jitter = 0.38;
  let seed = 42;
  const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF; return (seed >>> 0) / 0xFFFFFFFF; };

  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const bx = (c / cols) * w;
      const by = (r / rows) * h;

      // Don't jitter border points — keeps boundary clean
      const onBorder = r === 0 || r === rows || c === 0 || c === cols;
      if (onBorder) continue; // border already handled above

      const jx = (rand() - 0.5) * 2 * jitter * cellW;
      const jy = (rand() - 0.5) * 2 * jitter * cellH;
      pts.push({
        x: Math.max(0, Math.min(w, bx + jx)),
        y: Math.max(0, Math.min(h, by + jy)),
      });
    }
  }

  // Run Delaunay
  const tris = bowyer(pts);
  const triangles: number[] = [];
  for (const t of tris) {
    triangles.push(t.a, t.b, t.c);
  }

  return { restPoints: pts, triangles, gridW: cols + 1, gridH: rows + 1 };
}


/**
 * Deforms mesh vertices based on pins and restPins using Inverse Distance Weighting (IDW).
 */
export function deformMeshWithPins(
  restPoints: { x: number; y: number }[],
  pins: { x: number; y: number }[],
  restPins: { x: number; y: number }[],
  mode: PuppetWarpMode = 'normal'
): { x: number; y: number }[] {
  if (!restPoints || restPoints.length === 0) return [];
  if (!pins || !restPins || pins.length === 0 || pins.length !== restPins.length) {
    return restPoints.map((p) => ({ ...p }));
  }

  let power = 2;
  if (mode === 'rigid') power = 3;
  if (mode === 'distort') power = 1.2;

  const epsilon = 0.0001;

  return restPoints.map((pt) => {
    let totalWeight = 0;
    let dxSum = 0;
    let dySum = 0;
    let exactMatch: { x: number; y: number } | null = null;

    for (let k = 0; k < pins.length; k++) {
      const rp = restPins[k];
      const dp = pins[k];
      const distSq = (pt.x - rp.x) ** 2 + (pt.y - rp.y) ** 2;

      if (distSq < epsilon) {
        exactMatch = { ...dp };
        break;
      }

      const weight = 1 / distSq ** (power / 2);
      totalWeight += weight;
      dxSum += weight * (dp.x - rp.x);
      dySum += weight * (dp.y - rp.y);
    }

    if (exactMatch) return exactMatch;

    if (totalWeight < 1e-9) {
      return { ...pt };
    }

    return {
      x: pt.x + dxSum / totalWeight,
      y: pt.y + dySum / totalWeight,
    };
  });
}

/**
 * Renders Delaunay triangular mesh deformation onto 2D canvas context.
 */
export function renderDelaunayMesh(
  ctx: CanvasRenderingContext2D,
  origCanvas: HTMLCanvasElement | HTMLImageElement,
  originalLocal: { x: number; y: number }[],
  deformedLocal: { x: number; y: number }[],
  triangles: number[]
) {
  if (!ctx || !origCanvas || !originalLocal || !deformedLocal || !triangles || triangles.length < 3) return;

  const numTriangles = Math.floor(triangles.length / 3);

  ctx.save();
  for (let i = 0; i < numTriangles; i++) {
    const i0 = triangles[i * 3];
    const i1 = triangles[i * 3 + 1];
    const i2 = triangles[i * 3 + 2];

    const s0 = originalLocal[i0];
    const s1 = originalLocal[i1];
    const s2 = originalLocal[i2];

    const d0 = deformedLocal[i0];
    const d1 = deformedLocal[i1];
    const d2 = deformedLocal[i2];

    if (!s0 || !s1 || !s2 || !d0 || !d1 || !d2) continue;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(d0.x, d0.y);
    ctx.lineTo(d1.x, d1.y);
    ctx.lineTo(d2.x, d2.y);
    ctx.closePath();
    ctx.clip();

    const delta = (s0.x - s2.x) * (s1.y - s2.y) - (s1.x - s2.x) * (s0.y - s2.y);
    if (Math.abs(delta) >= 0.0001) {
      const a = ((d0.x - d2.x) * (s1.y - s2.y) - (d1.x - d2.x) * (s0.y - s2.y)) / delta;
      const c = ((s0.x - s2.x) * (d1.x - d2.x) - (s1.x - s2.x) * (d0.x - d2.x)) / delta;
      const e = d2.x - a * s2.x - c * s2.y;
      const b = ((d0.y - d2.y) * (s1.y - s2.y) - (d1.y - d2.y) * (s0.y - s2.y)) / delta;
      const d = ((s0.x - s2.x) * (d1.y - d2.y) - (s1.x - s2.x) * (d0.y - d2.y)) / delta;
      const f = d2.y - b * s2.x - d * s2.y;
      ctx.transform(a, b, c, d, e, f);
      ctx.drawImage(origCanvas, 0, 0);
    }
    ctx.restore();
  }
  ctx.restore();
}
