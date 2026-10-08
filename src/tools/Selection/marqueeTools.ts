import type { ToolModule } from '../types';
import { shouldClear } from './utils';

export const marqueeTools: ToolModule[] = [
  {
    id: 'marquee',
    start: ({ coords, setLassoPaths, setSelectionRect, setIsInteracting, selectionMode, isShift, isAlt, selectionRect }) => {
      const clear = shouldClear(selectionMode, isShift, isAlt);
      if (clear) {
        setLassoPaths([]);
      } else if (selectionRect) {
        // Commit the existing selectionRect as a finished rectangle path, then start a new drag
        const r = selectionRect;
        const rectPath = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
        setLassoPaths((prev: any) => [...prev, rectPath]);
      }
      // Always set a fresh selectionRect for live drag preview
      setSelectionRect({ x: coords.x, y: coords.y, w: 0, h: 0 }, 'rect');
      setIsInteracting(true);
    },
    move: ({ coords, startCoords, setSelectionRect }) => {
      if (!startCoords) return;
      setSelectionRect({ x: startCoords.x, y: startCoords.y, w: coords.x - startCoords.x, h: coords.y - startCoords.y }, 'rect');
    },
    end: ({ selectionRect, setLassoPaths, setSelectionRect, setIsInteracting, recordHistory }) => {
      if (!selectionRect) return;
      const r = selectionRect;
      const rectPath = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
      setLassoPaths((prev: any) => [...prev, rectPath]);
      setSelectionRect(null);
      setIsInteracting(false);
      recordHistory('Rectangle Select');
    }
  },
  {
    id: 'ellipse_marquee',
    start: ({ coords, setLassoPaths, setSelectionRect, setIsInteracting, selectionMode, isShift, isAlt, selectionRect }) => {
      const clear = shouldClear(selectionMode, isShift, isAlt);
      if (clear) {
        setLassoPaths([]);
      } else if (selectionRect) {
        // Commit existing selectionRect as a 36-point ellipse approximation, then start a new drag
        const r = selectionRect;
        const rx = Math.abs(r.w / 2);
        const ry = Math.abs(r.h / 2);
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        const path = Array.from({ length: 36 }, (_, i) => {
          const angle = (i * 2 * Math.PI) / 36;
          return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
        });
        setLassoPaths((prev: any) => [...prev, path]);
      }
      setSelectionRect({ x: coords.x, y: coords.y, w: 0, h: 0 }, 'ellipse');
      setIsInteracting(true);
    },
    move: ({ coords, startCoords, setSelectionRect }) => {
      if (!startCoords) return;
      setSelectionRect({ x: startCoords.x, y: startCoords.y, w: coords.x - startCoords.x, h: coords.y - startCoords.y }, 'ellipse');
    },
    end: ({ selectionRect, setLassoPaths, setSelectionRect, setIsInteracting, recordHistory }) => {
      if (!selectionRect) return;
      const r = selectionRect;
      const rx = Math.abs(r.w / 2);
      const ry = Math.abs(r.h / 2);
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const path = Array.from({ length: 36 }, (_, i) => {
        const angle = (i * 2 * Math.PI) / 36;
        return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
      });
      setLassoPaths((prev: any) => [...prev, path]);
      setSelectionRect(null);
      setIsInteracting(false);
      recordHistory('Ellipse Select');
    }
  }
];
