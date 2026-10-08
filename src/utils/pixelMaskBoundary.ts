// pixelMaskBoundary — extract polygonal outlines from a binary alpha mask.
//
// Shared by selectionBooleanOps (lasso/marquee composition) and
// shapeBooleanOps (shape-layer boolean operations). Given a Uint8Array mask
// (1 = inside, 0 = outside) and its (width, height), it returns one closed
// polyline per connected region in mask-local pixel coordinates. For
// single-region masks (e.g. a union of overlapping shapes) the result is a
// 1-element array; for excludes or other ops that produce holes, it contains
// every disjoint component so the consumer can re-combine them with evenodd
// fill.
//
// Implementation: Moore-neighbor contour tracing with the Pavlidis / Ren
// "left-hand-on-wall" variant. For each connected region we walk the outer
// boundary as a closed clockwise ring, then look for hole boundaries inside
// it and trace those as counter-clockwise rings. Each ring is a true closed
// polyline (perimeter pixels only) — not a scan-order concatenation — so
// `ctx.fill(path, 'evenodd')` produces a clean solid fill with no interior
// stripe artifacts.

import type { Point } from '../components/Canvas/types';

type Mask = Uint8Array;
type Visited = Uint8Array;

// 8-connected Moore neighborhood, ordered clockwise starting from the
// pixel directly to the right of the entry direction.
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],   // E
  [1, 1],   // SE
  [0, 1],   // S
  [-1, 1],  // SW
  [-1, 0],  // W
  [-1, -1], // NW
  [0, -1],  // N
  [1, -1],  // NE
];

/** Returns true if (x, y) is inside the canvas and the mask is set there. */
const isFilled = (mask: Mask, w: number, h: number, x: number, y: number): boolean => {
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  return mask[y * w + x] === 1;
};

/**
 * Trace one closed contour (outer ring for the first call, then a hole
 * ring for subsequent calls) starting at `start`. `entryDir` is the index
 * into DIRS for the direction we entered `start` from; for the outer ring
 * we pass 4 (W) since we always start at the topmost-leftmost filled pixel.
 *
 * Marks the traversed boundary pixels in `claimed` (so a later outer-ring
 * pass skips pixels already part of an inner hole) and writes visited
 * pixels into `trail` (so we can mark them as "consumed" once the contour
 * is closed, preventing re-tracing of the same outer ring on later scans).
 */
const traceContour = (
  mask: Mask,
  w: number,
  h: number,
  start: { x: number; y: number },
  entryDir: number,
  trail: Visited,
  claimed: Visited
): Point[] => {
  const contour: Point[] = [{ x: start.x, y: start.y }];
  trail[start.y * w + start.x] = 1;

  let cx = start.x;
  let cy = start.y;
  // Backtrack direction: we came from `entryDir`, so we begin searching
  // for the next boundary pixel one step clockwise of that.
  let backtrack = (entryDir + 6) % 8; // 6 = 270° clockwise from entry

  // Safety cap: a single contour can't have more pixels than the mask.
  const maxSteps = w * h + 8;
  for (let step = 0; step < maxSteps; step++) {
    let found = false;
    // Search the 8 neighbors clockwise starting at backtrack+1.
    for (let k = 1; k <= 8; k++) {
      const dir = (backtrack + k) % 8;
      const [dx, dy] = DIRS[dir];
      const nx = cx + dx;
      const ny = cy + dy;
      if (isFilled(mask, w, h, nx, ny)) {
        // Move to (nx, ny). The new entry direction is opposite of `dir`.
        const newEntry = (dir + 4) % 8;
        contour.push({ x: nx, y: ny });
        trail[ny * w + nx] = 1;
        claimed[ny * w + nx] = 1;
        cx = nx;
        cy = ny;
        // Set the backtrack for the next step: it's the direction we just
        // came from (opposite of `dir`), i.e. `newEntry`.
        backtrack = newEntry;
        found = true;
        break;
      }
    }
    if (!found) {
      // Isolated pixel — emit it and stop.
      break;
    }
    // Stop when we return to the start with the same entry direction.
    if (cx === start.x && cy === start.y && contour.length > 2) {
      break;
    }
  }
  return contour;
};

/**
 * Find the topmost-leftmost filled pixel that is on the boundary of its
 * region (i.e. has at least one 4-connected neighbor outside the mask or
 * off the canvas). Returns null if every filled pixel is already claimed
 * by a previously traced contour.
 */
const findStart = (
  mask: Mask,
  w: number,
  h: number,
  claimed: Visited
): { x: number; y: number } | null => {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (mask[idx] !== 1 || claimed[idx]) continue;
      // Must be on the region boundary.
      const onEdge =
        !isFilled(mask, w, h, x + 1, y) ||
        !isFilled(mask, w, h, x - 1, y) ||
        !isFilled(mask, w, h, x, y + 1) ||
        !isFilled(mask, w, h, x, y - 1);
      if (onEdge) return { x, y };
    }
  }
  return null;
};

// Drop vertices that lie on the straight line between their two neighbors.
// A point P is collinear with A→B iff (B - A) × (P - A) == 0. We always keep
// the first and last point so the polyline stays closed with the same shape.
//
// The Moore-neighbor tracer emits one vertex per boundary pixel, so a clean
// 99×99 axis-aligned rectangle becomes a 396-point staircase polygon. With
// `fillRule:'evenodd'` that many horizontal/vertical segments create hundreds
// of crossings, and the parity flips at every pixel — producing the
// "perforated fill" (stripes / holes) artifact when the path is consumed by
// Canvas2D / SVG. Compressing collinear runs to a single segment fixes this.
const simplifyPolyline = (poly: Point[]): Point[] => {
  if (poly.length < 3) return poly;
  const out: Point[] = [poly[0]];
  for (let i = 1; i < poly.length - 1; i++) {
    const a = out[out.length - 1];
    const p = poly[i];
    const b = poly[i + 1];
    const dx1 = p.x - a.x;
    const dy1 = p.y - a.y;
    const dx2 = b.x - p.x;
    const dy2 = b.y - p.y;
    // Cross product of (p - a) and (b - p). Zero ⇒ collinear.
    if (dx1 * dy2 - dy1 * dx2 !== 0) {
      out.push(p);
    }
  }
  out.push(poly[poly.length - 1]);
  return out;
};

// Fix 45° diagonal steps. The Moore-neighbor tracer skips interior corners
// (a pixel that has all 4 4-connected neighbors filled), so a 90° inside
// corner becomes a single diagonal segment like (199,99)→(200,100). When the
// resulting polyline is fed to `ctx.fill` it produces a small triangle
// missing — the inside corner gets "rounded off" by 1 pixel.
//
// For each consecutive pair (A, B) where |Δx| == |Δy| == 1 we expand the
// diagonal into a 3-vertex "step" that follows the boundary. We pick the
// corner that is NOT inside the region so the path traces the OUTER edge
// of the shape (the visible boundary), not a path that cuts the corner
// inside the region by 1 pixel. Both corners produce mathematically valid
// 90° turns, but only the "outside" one matches what the user sees on
// the canvas.
const fixDiagonalSteps = (poly: Point[], mask: Mask, w: number, h: number): Point[] => {
  if (poly.length < 3) return poly;
  const out: Point[] = [poly[0]];
  for (let i = 0; i < poly.length - 1; i++) {
    const a = out[out.length - 1];
    const b = poly[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
      // Two possible right-angle corners: (a.x, b.y) or (b.x, a.y).
      // Pick the one that's NOT inside the region — that traces the outer
      // boundary. If both happen to be filled (degenerate 1×1 region), fall
      // back to the first; if neither is filled, also fall back to the first
      // to keep behavior stable.
      const corner1 = { x: a.x, y: b.y };
      const corner2 = { x: b.x, y: a.y };
      const c1Inside =
        corner1.x >= 0 && corner1.x < w && corner1.y >= 0 && corner1.y < h &&
        mask[corner1.y * w + corner1.x] === 1;
      const c2Inside =
        corner2.x >= 0 && corner2.x < w && corner2.y >= 0 && corner2.y < h &&
        mask[corner2.y * w + corner2.x] === 1;
      // The "outside" corner is the one NOT filled in the mask. For outer
      // rings, the boundary runs along the outside of the filled region, so
      // the corner we want is the one in empty space (a continuation of the
      // existing boundary line). For a 4-connected step like A=(199,99) →
      // B=(200,100), the Moore trace actually goes (199,99)→(199,100)→
      // (200,100) (a 1-pixel inside detour), and we want to "straighten" it
      // to (199,99)→(200,99)→(200,100) which matches the geometric L
      // boundary the user sees.
      const outside = !c1Inside ? corner1 : !c2Inside ? corner2 : corner1;
      out.push(outside);
    }
    out.push(b);
  }
  return out;
};

export const tracePixelMaskBoundary = (
  mask: Mask,
  width: number,
  height: number
): Point[][] => {
  const w = width;
  const h = height;
  const claimed = new Uint8Array(w * h);
  const polylines: Point[][] = [];

  let safety = 256; // upper bound on number of disjoint regions per call
  while (safety-- > 0) {
    const start = findStart(mask, w, h, claimed);
    if (!start) break;

    // Trace the outer ring. Entry direction: W (we conceptually entered
    // from the left of the topmost-leftmost pixel).
    const trail = new Uint8Array(w * h);
    const outer = traceContour(mask, w, h, start, 4, trail, claimed);
    if (outer.length >= 3) {
      polylines.push(outer);
    }

    // Now scan inside the outer's bounding box for hole boundaries —
    // filled pixels adjacent to the outer ring that we didn't claim yet.
    // Each hole is its own closed ring; evenodd fill in the consumer turns
    // them into holes.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    outer.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
    if (!isFinite(minX)) continue;

    const x0 = Math.max(0, minX);
    const y0 = Math.max(0, minY);
    const x1 = Math.min(w - 1, maxX);
    const y1 = Math.min(h - 1, maxY);

    let holeSafety = 1024;
    outerScan: while (holeSafety-- > 0) {
      let holeStart: { x: number; y: number } | null = null;
      for (let y = y0; y <= y1 && !holeStart; y++) {
        for (let x = x0; x <= x1; x++) {
          const idx = y * w + x;
          if (mask[idx] !== 1 || claimed[idx]) continue;
          // Treat already-traversed outer pixels as boundary too, so
          // the hole tracer can "enter" from them.
          if (trail[idx]) {
            holeStart = { x, y };
            break;
          }
          // Or a fresh background neighbor.
          const isHoleEdge =
            !isFilled(mask, w, h, x + 1, y) ||
            !isFilled(mask, w, h, x - 1, y) ||
            !isFilled(mask, w, h, x, y + 1) ||
            !isFilled(mask, w, h, x, y - 1);
          if (isHoleEdge) {
            holeStart = { x, y };
            break;
          }
        }
      }
      if (!holeStart) break outerScan;

      const holeTrail = new Uint8Array(w * h);
      const hole = traceContour(mask, w, h, holeStart, 4, holeTrail, claimed);
      if (hole.length >= 3) {
        polylines.push(hole);
      }
      // Mark the hole trail as claimed too so we don't re-pick it.
      for (let i = 0; i < w * h; i++) {
        if (holeTrail[i]) claimed[i] = 1;
      }
    }

    // Mark the outer's trail pixels as claimed so the next outer scan
    // starts on a fresh region.
    for (let i = 0; i < w * h; i++) {
      if (trail[i]) claimed[i] = 1;
    }
  }

  // Compress collinear runs. See simplifyPolyline for why this is needed.
  // Then fix 45° diagonal steps. See fixDiagonalSteps for why.
  return polylines.map((poly) => fixDiagonalSteps(simplifyPolyline(poly), mask, w, h));
};
