export const findContour = (
  mask: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  offset?: { x: number, y: number }
) => {
  const contour: { x: number, y: number }[] = [];
  let currX = -1, currY = -1;

  // 1. Find a boundary pixel (a pixel that is 1 and has a 0 neighbor)
  // Search in a widening square around the start point
  let found = false;
  for (let r = 0; r < Math.max(width, height) && !found; r += 5) {
    for (let y = Math.max(0, startY - r); y <= Math.min(height - 1, startY + r) && !found; y += (r > 0 ? r : 1)) {
      for (let x = Math.max(0, startX - r); x <= Math.min(width - 1, startX + r); x++) {
        if (mask[y * width + x]) {
          // Check if it's a boundary pixel
          const hasZeroNeighbor = (
            (x > 0 && !mask[y * width + (x - 1)]) ||
            (x < width - 1 && !mask[y * width + (x + 1)]) ||
            (y > 0 && !mask[(y - 1) * width + x]) ||
            (y < height - 1 && !mask[(y + 1) * width + x])
          );
          if (hasZeroNeighbor) {
            currX = x; currY = y;
            found = true;
            break;
          }
        }
      }
    }
  }

  if (!found) return [];

  const sX = currX, sY = currY;
  let prevX = currX - 1, prevY = currY;
  let limit = 50000; // Increased limit for complex shapes

  // 2. Moore Neighborhood Tracing
  do {
    contour.push({ x: currX + (offset?.x || 0), y: currY + (offset?.y || 0) });
    
    // Relative directions (clockwise)
    const dirs = [
      [currX - 1, currY - 1], [currX, currY - 1], [currX + 1, currY - 1],
      [currX + 1, currY], [currX + 1, currY + 1], [currX, currY + 1],
      [currX - 1, currY + 1], [currX - 1, currY]
    ];

    let startDir = 0;
    for (let i = 0; i < 8; i++) {
      if (dirs[i][0] === prevX && dirs[i][1] === prevY) {
        startDir = (i + 1) % 8;
        break;
      }
    }

    let nextFound = false;
    for (let i = 0; i < 8; i++) {
      const idx = (startDir + i) % 8;
      const [nx, ny] = dirs[idx];
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && mask[ny * width + nx]) {
        prevX = currX; prevY = currY;
        currX = nx; currY = ny;
        nextFound = true;
        break;
      }
    }

    if (!nextFound) break;
    limit--;
  } while ((currX !== sX || currY !== sY) && limit > 0);

  // 3. Adaptive Simplification (Douglas-Peucker is ideal, but radial distance is faster)
  const simplified: { x: number, y: number }[] = [];
  const tolerance = 4; // Max distance between points
  if (contour.length > 0) {
    simplified.push(contour[0]);
    let lastPoint = contour[0];
    for (let i = 1; i < contour.length; i++) {
      const dist = Math.hypot(contour[i].x - lastPoint.x, contour[i].y - lastPoint.y);
      if (dist >= tolerance) {
        simplified.push(contour[i]);
        lastPoint = contour[i];
      }
    }
    simplified.push(contour[contour.length - 1]);
  }

  return simplified;
};

export const findAllContours = (
  mask: Uint8Array,
  width: number,
  height: number,
  offset?: { x: number, y: number }
) => {
  const allContours: { x: number, y: number }[][] = [];
  const tempMask = new Uint8Array(mask);
  const queue: number[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (tempMask[idx]) {
        const contour = findContour(tempMask, width, height, x, y, offset);
        if (contour.length > 3) {
          allContours.push(contour);
        }

        queue.length = 0;
        queue.push(idx);
        tempMask[idx] = 0;

        while (queue.length > 0) {
          const current = queue.pop()!;
          const cx = current % width;
          const cy = Math.floor(current / width);

          const neighbors = [
            current - 1,
            current + 1,
            current - width,
            current + width,
          ];

          if (cx === 0) neighbors[0] = -1;
          if (cx === width - 1) neighbors[1] = -1;
          if (cy === 0) neighbors[2] = -1;
          if (cy === height - 1) neighbors[3] = -1;

          for (const next of neighbors) {
            if (next >= 0 && tempMask[next]) {
              tempMask[next] = 0;
              queue.push(next);
            }
          }
        }
      }
    }
  }
  return allContours;
};

export const findBestEdgePoint = (
  ctx: CanvasRenderingContext2D | null,
  x: number,
  y: number,
  radius: number
) => {
  if (!ctx) return { x, y };
  const rx = Math.round(x);
  const ry = Math.round(y);
  const size = radius * 2;
  try {
    const imageData = ctx.getImageData(rx - radius, ry - radius, size, size);
    const data = imageData.data;
    let maxGrad = -1, bestX = x, bestY = y;
    const getScore = (i: number, j: number) => {
      const idx = (j * size + i) * 4;
      return idx < 0 || idx >= data.length ? 0 : (data[idx] + data[idx+1] + data[idx+2]) * (data[idx+3] / 255);
    };
    for (let j = 1; j < size - 1; j++) {
      for (let i = 1; i < size - 1; i++) {
        const gx = getScore(i + 1, j) - getScore(i - 1, j);
        const gy = getScore(i, j + 1) - getScore(i, j - 1);
        const grad = gx * gx + gy * gy;
        if (grad > maxGrad) { maxGrad = grad; bestX = rx - radius + i; bestY = ry - radius + j; }
      }
    }
    return { x: bestX, y: bestY };
  } catch { return { x, y }; }
};
