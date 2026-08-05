import type { ToolModule } from '../types';
import { shouldClear } from './utils';

export const marqueeTools: ToolModule[] = [
  {
    id: 'marquee',
    start: ({ coords, setLassoPaths, setSelectionRect, setIsInteracting, selectionMode, isShift, isAlt, selectionRect }) => {
      const clear = shouldClear(selectionMode, isShift, isAlt);
      if (clear) {
        setLassoPaths([]);
        setSelectionRect({ x: coords.x, y: coords.y, w: 0, h: 0 }, 'rect');
      } else {
        if (selectionRect) {
          const r = selectionRect;
          const rectPath = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
          setLassoPaths((prev: any) => [...prev, rectPath]);
          setSelectionRect(null);
        }
        // Append a temporary 4-point path
        setLassoPaths((prev: any) => [...prev, [coords, coords, coords, coords]]);
      }
      setIsInteracting(true);
    },
    move: ({ coords, startCoords, setSelectionRect, setLassoPaths, selectionMode, isShift, isAlt }) => {
      if (!startCoords) return;
      const clear = shouldClear(selectionMode, isShift, isAlt);
      if (clear) {
        setSelectionRect({ x: startCoords.x, y: startCoords.y, w: coords.x - startCoords.x, h: coords.y - startCoords.y }, 'rect');
      } else {
        const r = { x: startCoords.x, y: startCoords.y, w: coords.x - startCoords.x, h: coords.y - startCoords.y };
        const path = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
        setLassoPaths((prev: any) => {
          const next = [...prev];
          next[next.length - 1] = path;
          return next;
        });
      }
    }
  },
  {
    id: 'ellipse_marquee',
    start: ({ coords, setLassoPaths, setSelectionRect, setIsInteracting, selectionMode, isShift, isAlt, selectionRect }) => {
      const clear = shouldClear(selectionMode, isShift, isAlt);
      if (clear) {
        setLassoPaths([]);
        setSelectionRect({ x: coords.x, y: coords.y, w: 0, h: 0 }, 'ellipse');
      } else {
        if (selectionRect) {
          const r = selectionRect;
          const rectPath = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
          setLassoPaths((prev: any) => [...prev, rectPath]);
          setSelectionRect(null);
        }
        // Approximate ellipse using a 36-point path
        const pts = Array.from({ length: 36 }, () => coords);
        setLassoPaths((prev: any) => [...prev, pts]);
      }
      setIsInteracting(true);
    },
    move: ({ coords, startCoords, setSelectionRect, setLassoPaths, selectionMode, isShift, isAlt }) => {
      if (!startCoords) return;
      const clear = shouldClear(selectionMode, isShift, isAlt);
      if (clear) {
        setSelectionRect({ x: startCoords.x, y: startCoords.y, w: coords.x - startCoords.x, h: coords.y - startCoords.y }, 'ellipse');
      } else {
        const r = { x: startCoords.x, y: startCoords.y, w: coords.x - startCoords.x, h: coords.y - startCoords.y };
        const rx = Math.abs(r.w / 2);
        const ry = Math.abs(r.h / 2);
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        const path = Array.from({ length: 36 }, (_, i) => {
          const angle = (i * 2 * Math.PI) / 36;
          return {
            x: cx + rx * Math.cos(angle),
            y: cy + ry * Math.sin(angle)
          };
        });
        setLassoPaths((prev: any) => {
          const next = [...prev];
          next[next.length - 1] = path;
          return next;
        });
      }
    }
  }
];
