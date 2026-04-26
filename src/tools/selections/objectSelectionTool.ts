import type { ToolModule } from '../types';
import { findContour } from '../../utils/canvasUtils';

export const objectSelectionTool: ToolModule = {
  id: 'object_selection',
  start: ({ coords, setSelectionRect, setIsInteracting }) => {
    setSelectionRect({ x: coords.x, y: coords.y, w: 0, h: 0 }, 'rect');
    setIsInteracting(true);
  },
  move: ({ coords, startCoords, setSelectionRect }) => {
    if (!startCoords) return;
    setSelectionRect({ x: startCoords.x, y: startCoords.y, w: coords.x - startCoords.x, h: coords.y - startCoords.y }, 'rect');
  },
  end: ({ selectionRect, setSelectionRect, activeLayerId, layers, canvas, ctx, selectionTolerance, selectionContiguous, setLassoPaths, recordHistory }) => {
    if (!selectionRect || !ctx || !canvas) return;
    const layer = layers.find(l => l.id === activeLayerId), centerX = selectionRect.x + selectionRect.w / 2, centerY = selectionRect.y + selectionRect.h / 2;
    const lx = Math.round(centerX - (layer?.position.x || 0)), ly = Math.round(centerY - (layer?.position.y || 0));
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height), data = imgData.data;
    const targetIdx = (ly * canvas.width + lx) * 4, targetR = data[targetIdx], targetG = data[targetIdx+1], targetB = data[targetIdx+2];
    const visited = new Uint8Array(canvas.width * canvas.height), tolerance = selectionTolerance;
    if (selectionContiguous) {
      const queue: [number, number][] = [[lx, ly]];
      visited[ly * canvas.width + lx] = 1;
      const dx = [1, -1, 0, 0], dy = [0, 0, 1, -1];
      while (queue.length > 0) {
        const [cx, cy] = queue.pop()!;
        for (let i = 0; i < 4; i++) {
          const nx = cx + dx[i], ny = cy + dy[i];
          if (nx >= 0 && nx < canvas.width && ny >= 0 && ny < canvas.height && !visited[ny * canvas.width + nx]) {
            const pIdx = (ny * canvas.width + nx) * 4;
            if (Math.abs(data[pIdx]-targetR)<=tolerance && Math.abs(data[pIdx+1]-targetG)<=tolerance && Math.abs(data[pIdx+2]-targetB)<=tolerance) {
              visited[ny * canvas.width + nx] = 1; queue.push([nx, ny]);
            }
          }
        }
      }
    } else {
      for (let i = 0; i < data.length; i += 4) {
        if (Math.abs(data[i]-targetR)<=tolerance && Math.abs(data[i+1]-targetG)<=tolerance && Math.abs(data[i+2]-targetB)<=tolerance) visited[i/4] = 1;
      }
    }
    const contour = findContour(visited, canvas.width, canvas.height, lx, ly, layer?.position);
    if (contour.length > 0) {
      setLassoPaths([contour]); setSelectionRect(null); recordHistory('Object Selection');
    }
  }
};
