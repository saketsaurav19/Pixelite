import type { Point } from '../types';

export const getCoordinates = (
  clientX: number,
  clientY: number,
  stackElement: HTMLDivElement | null,
  documentSize: { w: number, h: number },
  allowOutside: boolean = false
): Point | null => {
  if (!stackElement) return null;
  const rect = stackElement.getBoundingClientRect();

  const nx = (clientX - rect.left) / rect.width;
  const ny = (clientY - rect.top) / rect.height;

  // For most tools, reject clicks outside the canvas bounds
  if (!allowOutside && (nx < 0 || ny < 0 || nx > 1 || ny > 1)) {
    return null;
  }

  return {
    x: nx * documentSize.w,
    y: ny * documentSize.h
  };
};

export const getSnappedCoords = (
  coords: Point,
  vectorPaths: any[],
  lassoPaths: Point[][],
  zoom: number,
  exclude?: { pathIdx: number, pointIdx: number },
  threshold: number = 12
): Point => {
  const snapDist = threshold / (zoom || 1);

  // Check Vector Paths
  for (let pIdx = 0; pIdx < vectorPaths.length; pIdx++) {
    const path = vectorPaths[pIdx];
    for (let ptIdx = 0; ptIdx < path.points.length; ptIdx++) {
      if (exclude && exclude.pathIdx === pIdx && exclude.pointIdx === ptIdx) continue;
      const p = path.points[ptIdx];
      if (Math.hypot(coords.x - p.x, coords.y - p.y) < snapDist) {
        return { x: p.x, y: p.y };
      }
    }
  }

  // Check Lasso Paths
  for (const path of lassoPaths) {
    for (const p of path) {
      if (Math.hypot(coords.x - p.x, coords.y - p.y) < snapDist) {
        return { x: p.x, y: p.y };
      }
    }
  }

  return coords;
};
