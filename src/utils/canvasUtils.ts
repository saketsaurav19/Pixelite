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

export const warpPerspective = (
  ctx: CanvasRenderingContext2D,
  points: { x: number, y: number }[], // 4 corners: TL, TR, BR, BL
  targetWidth: number,
  targetHeight: number
) => {
  const canvas = ctx.canvas;
  const srcData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = targetWidth;
  dstCanvas.height = targetHeight;
  const dstCtx = dstCanvas.getContext('2d')!;
  const dstData = dstCtx.createImageData(targetWidth, targetHeight);

  // Solve for Homography Matrix H (3x3) using 4 points
  const getTransform = (src: { x: number, y: number }[], dst: { x: number, y: number }[]) => {
    const A: number[][] = [];
    for (let i = 0; i < 4; i++) {
      A.push([dst[i].x, dst[i].y, 1, 0, 0, 0, -src[i].x * dst[i].x, -src[i].x * dst[i].y]);
      A.push([0, 0, 0, dst[i].x, dst[i].y, 1, -src[i].y * dst[i].x, -src[i].y * dst[i].y]);
    }
    const B = [src[0].x, src[0].y, src[1].x, src[1].y, src[2].x, src[2].y, src[3].x, src[3].y];
    
    // Gaussian elimination solver
    const n = B.length;
    for (let i = 0; i < n; i++) {
      let max = i;
      for (let j = i + 1; j < n; j++) if (Math.abs(A[j][i]) > Math.abs(A[max][i])) max = j;
      [A[i], A[max]] = [A[max], A[i]]; [B[i], B[max]] = [B[max], B[i]];
      for (let j = i + 1; j < n; j++) {
        const factor = A[j][i] / A[i][i];
        B[j] -= factor * B[i];
        for (let k = i; k < n; k++) A[j][k] -= factor * A[i][k];
      }
    }
    const X = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0;
      for (let j = i + 1; j < n; j++) sum += A[i][j] * X[j];
      X[i] = (B[i] - sum) / A[i][i];
    }
    return [...X, 1];
  };

  const dstPoints = [{x:0, y:0}, {x:targetWidth, y:0}, {x:targetWidth, y:targetHeight}, {x:0, y:targetHeight}];
  const h = getTransform(points, dstPoints);

  const src = srcData.data, dst = dstData.data;
  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const z = h[6] * x + h[7] * y + h[8];
      const px = (h[0] * x + h[1] * y + h[2]) / z;
      const py = (h[3] * x + h[4] * y + h[5]) / z;
      
      if (px >= 0 && px < canvas.width - 1 && py >= 0 && py < canvas.height - 1) {
        const ix = Math.floor(px), iy = Math.floor(py);
        const idx1 = (iy * canvas.width + ix) * 4, idx2 = idx1 + 4, idx3 = idx1 + canvas.width * 4, idx4 = idx3 + 4;
        const fx = px - ix, fy = py - iy;
        for (let c = 0; c < 4; c++) {
          dst[(y * targetWidth + x) * 4 + c] = 
            src[idx1 + c] * (1-fx) * (1-fy) + src[idx2 + c] * fx * (1-fy) +
            src[idx3 + c] * (1-fx) * fy + src[idx4 + c] * fx * fy;
        }
      }
    }
  }
  return dstData;
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
