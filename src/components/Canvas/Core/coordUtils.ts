import type { Point } from '../types';

export const getCoordinates = (
  clientX: number,
  clientY: number,
  stackElement: HTMLDivElement | null,
  documentSize: { w: number, h: number },
  allowOutside: boolean = false,
  clamp: boolean = false
): Point | null => {
  if (!stackElement) return null;
  const rect = stackElement.getBoundingClientRect();

  let nx = (clientX - rect.left) / rect.width;
  let ny = (clientY - rect.top) / rect.height;

  if (clamp) {
    nx = Math.max(0, Math.min(1, nx));
    ny = Math.max(0, Math.min(1, ny));
  } else if (!allowOutside && (nx < 0 || ny < 0 || nx > 1 || ny > 1)) {
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

export const getLayerLocalCoords = (
  docCoords: Point | null,
  layer?: { position?: { x: number; y: number }; rotation?: number }
): Point | null => {
  if (!docCoords) return null;
  if (!layer) return docCoords;

  const posX = layer.position?.x || 0;
  const posY = layer.position?.y || 0;
  const rotDeg = layer.rotation || 0;

  let dx = docCoords.x - posX;
  let dy = docCoords.y - posY;

  if (rotDeg !== 0) {
    const rad = (-rotDeg * Math.PI) / 180;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
    dx = rx;
    dy = ry;
  }

  return { x: dx, y: dy };
};
