import type { ToolModule } from './types';

export const transformTools: ToolModule[] = [
  {
    id: 'hand',
    start: ({ setIsInteracting }) => {
      setIsInteracting(true);
    }
  },
  {
    id: 'move',
    move: ({ coords, lastPoint, activeLayerId, layers, updateLayer }) => {
      if (!lastPoint || !activeLayerId) return;
      const activeLayer = layers.find(l => l.id === activeLayerId);
      if (activeLayer && !activeLayer.locked) {
        const dx = coords.x - lastPoint.x;
        const dy = coords.y - lastPoint.y;
        updateLayer(activeLayerId, { 
          position: { 
            x: activeLayer.position.x + dx, 
            y: activeLayer.position.y + dy 
          } 
        });
      }
    }
  }
];
