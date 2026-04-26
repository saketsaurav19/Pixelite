import type { ToolModule } from '../types';
import { shouldClear } from './utils';

export const marqueeTools: ToolModule[] = [
  {
    id: 'marquee',
    start: ({ coords, setLassoPaths, setSelectionRect, setIsInteracting, selectionMode, isShift, isAlt }) => {
      if (shouldClear(selectionMode, isShift, isAlt)) setLassoPaths([]);
      setSelectionRect({ x: coords.x, y: coords.y, w: 0, h: 0 }, 'rect');
      setIsInteracting(true);
    },
    move: ({ coords, startCoords, setSelectionRect }) => {
      if (!startCoords) return;
      setSelectionRect({ x: startCoords.x, y: startCoords.y, w: coords.x - startCoords.x, h: coords.y - startCoords.y }, 'rect');
    }
  },
  {
    id: 'ellipse_marquee',
    start: ({ coords, setLassoPaths, setSelectionRect, setIsInteracting, selectionMode, isShift, isAlt }) => {
      if (shouldClear(selectionMode, isShift, isAlt)) setLassoPaths([]);
      setSelectionRect({ x: coords.x, y: coords.y, w: 0, h: 0 }, 'ellipse');
      setIsInteracting(true);
    },
    move: ({ coords, startCoords, setSelectionRect }) => {
      if (!startCoords) return;
      setSelectionRect({ x: startCoords.x, y: startCoords.y, w: coords.x - startCoords.x, h: coords.y - startCoords.y }, 'ellipse');
    }
  }
];
