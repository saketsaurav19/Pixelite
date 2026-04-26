import type { ToolModule } from './types';

export const paintingTools: ToolModule[] = [
  {
    id: 'brush',
    start: ({ coords, ctx, brushSize, brushColor, setIsInteracting }) => {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      setIsInteracting(true);
    },
    move: ({ coords, ctx, lastPoint, brushSize, brushColor }) => {
      if (!lastPoint) return;
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.stroke();
    }
  },
  {
    id: 'eraser',
    start: ({ coords, ctx, brushSize, setIsInteracting }) => {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      setIsInteracting(true);
    },
    move: ({ coords, ctx, lastPoint, brushSize }) => {
      if (!lastPoint) return;
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.lineWidth = brushSize;
      ctx.stroke();
    },
    end: ({ ctx }) => {
      ctx.globalCompositeOperation = 'source-over';
    }
  }
];
