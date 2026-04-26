import type { ToolModule } from '../types';

const traceContour = (
  mask: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  offset?: { x: number; y: number }
) => {
  const contour: { x: number; y: number }[] = [];
  let currX = startX;
  let currY = startY;
  let prevX = currX - 1;
  let prevY = currY;
  const firstX = currX;
  const firstY = currY;
  let limit = 10000;

  do {
    contour.push({ x: currX + (offset?.x || 0), y: currY + (offset?.y || 0) });

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

    let found = false;
    for (let i = 0; i < 8; i++) {
      const nextIdx = (startDir + i) % 8;
      const [nx, ny] = dirs[nextIdx];
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && mask[ny * width + nx]) {
        prevX = currX;
        prevY = currY;
        currX = nx;
        currY = ny;
        found = true;
        break;
      }
    }

    if (!found) break;
    limit--;
  } while ((currX !== firstX || currY !== firstY) && limit > 0);

  const simplified: { x: number; y: number }[] = [];
  for (let i = 0; i < contour.length; i++) {
    if (i === 0 || i === contour.length - 1) {
      simplified.push(contour[i]);
      continue;
    }
    const prev = contour[i - 1];
    const curr = contour[i];
    const next = contour[i + 1];
    const isSameDir = (curr.x - prev.x === next.x - curr.x) && (curr.y - prev.y === next.y - curr.y);
    if (!isSameDir || i % 4 === 0) {
      simplified.push(curr);
    }
  }

  return simplified;
};

const contoursFromMask = (
  mask: Uint8Array,
  width: number,
  height: number,
  offset?: { x: number; y: number }
) => {
  const tempMask = new Uint8Array(mask);
  const contours: { x: number; y: number }[][] = [];
  const queue: number[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (!tempMask[idx]) continue;

      let leftmostX = x;
      let leftmostY = y;
      queue.length = 0;
      queue.push(idx);
      tempMask[idx] = 0;

      while (queue.length > 0) {
        const current = queue.pop()!;
        const cx = current % width;
        const cy = Math.floor(current / width);

        if (cx < leftmostX || (cx === leftmostX && cy < leftmostY)) {
          leftmostX = cx;
          leftmostY = cy;
        }

        const neighbors = [
          cx > 0 ? current - 1 : -1,
          cx < width - 1 ? current + 1 : -1,
          cy > 0 ? current - width : -1,
          cy < height - 1 ? current + width : -1,
        ];

        for (const next of neighbors) {
          if (next >= 0 && tempMask[next]) {
            tempMask[next] = 0;
            queue.push(next);
          }
        }
      }

      const contour = traceContour(mask, width, height, leftmostX, leftmostY, offset);
      if (contour.length > 2) {
        contours.push(contour);
      }
    }
  }

  return contours;
};

const createMaskFromPaths = (
  width: number,
  height: number,
  paths: { x: number; y: number }[][],
  offset?: { x: number; y: number }
) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx || paths.length === 0) return new Uint8Array(width * height);

  ctx.fillStyle = '#fff';
  ctx.beginPath();
  paths.forEach((path) => {
    if (path.length < 2) return;
    ctx.moveTo(path[0].x - (offset?.x || 0), path[0].y - (offset?.y || 0));
    path.forEach((point) => ctx.lineTo(point.x - (offset?.x || 0), point.y - (offset?.y || 0)));
    ctx.closePath();
  });
  ctx.fill('evenodd');

  const imageData = ctx.getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = imageData[i * 4 + 3] > 0 ? 1 : 0;
  }
  return mask;
};

export const quickSelectionTool: ToolModule = {
  id: 'quick_selection',
  start: ({
    coords,
    canvas,
    ctx,
    layers,
    activeLayerId,
    selectionMode,
    isShift,
    isAlt,
    selectionTolerance,
    lassoPaths,
    setLassoPaths,
    setSelectionRect,
    recordHistory,
  }) => {
    if (!ctx || !canvas) return;

    const id = activeLayerId || layers[0]?.id;
    const layer = layers.find((entry) => entry.id === id);
    const lx = Math.round(coords.x - (layer?.position.x || 0));
    const ly = Math.round(coords.y - (layer?.position.y || 0));

    if (lx < 0 || ly < 0 || lx >= canvas.width || ly >= canvas.height) return;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const targetIdx = (ly * canvas.width + lx) * 4;
    const targetR = data[targetIdx];
    const targetG = data[targetIdx + 1];
    const targetB = data[targetIdx + 2];
    const targetA = data[targetIdx + 3];

    const tolerance = selectionTolerance || 30;
    const visited = new Uint8Array(canvas.width * canvas.height);
    const queue: [number, number][] = [[lx, ly]];
    visited[ly * canvas.width + lx] = 1;

    const dx = [1, -1, 0, 0];
    const dy = [0, 0, 1, -1];

    let processedCount = 0;
    while (queue.length > 0) {
      const point = queue.pop();
      if (!point) continue;
      const [cx, cy] = point;
      processedCount++;

      for (let i = 0; i < 4; i++) {
        const nx = cx + dx[i];
        const ny = cy + dy[i];

        if (nx >= 0 && nx < canvas.width && ny >= 0 && ny < canvas.height) {
          const nIdx = ny * canvas.width + nx;
          if (!visited[nIdx]) {
            const pIdx = nIdx * 4;
            if (
              Math.abs(data[pIdx] - targetR) < tolerance &&
              Math.abs(data[pIdx + 1] - targetG) < tolerance &&
              Math.abs(data[pIdx + 2] - targetB) < tolerance &&
              Math.abs(data[pIdx + 3] - targetA) < tolerance
            ) {
              visited[nIdx] = 1;
              queue.push([nx, ny]);
            }
          }
        }
      }

      if (processedCount > canvas.width * canvas.height) break;
    }

    if (processedCount <= 10) return;

    const contours = contoursFromMask(visited, canvas.width, canvas.height, layer?.position);
    if (contours.length === 0) return;

    const shouldAdd = selectionMode === 'add' || isShift;
    const shouldSubtract = selectionMode === 'subtract' || isAlt;
    if (shouldAdd || shouldSubtract) {
      const existingMask = createMaskFromPaths(canvas.width, canvas.height, lassoPaths, layer?.position);
      for (let i = 0; i < visited.length; i++) {
        if (visited[i]) existingMask[i] = shouldSubtract ? 0 : 1;
      }
      const mergedContours = contoursFromMask(existingMask, canvas.width, canvas.height, layer?.position);
      setLassoPaths(mergedContours);
    } else {
      setLassoPaths(contours);
    }
    setSelectionRect(null);
    recordHistory('Quick Selection');
  },
};
