import type { ToolModule } from '../types';

export const artboardTool: ToolModule = {
  id: 'artboard',
  start: ({ coords, setIsInteracting }) => {
    setIsInteracting(true);
    window.dispatchEvent(new CustomEvent('draw-draft-rect', {
      detail: { x: coords.x, y: coords.y, w: 0, h: 0 }
    }));
  },

  move: ({ coords, startCoords }) => {
    if (!startCoords) return;
    window.dispatchEvent(new CustomEvent('draw-draft-rect', {
      detail: {
        x: startCoords.x,
        y: startCoords.y,
        w: coords.x - startCoords.x,
        h: coords.y - startCoords.y,
      }
    }));
  },

  end: ({ setIsInteracting }) => {
    window.dispatchEvent(new CustomEvent('clear-draft-rect'));
    setIsInteracting(false);
  },
};
