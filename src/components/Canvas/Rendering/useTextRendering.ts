import { useEffect } from 'react';

interface TextRenderingOptions {
  textEditor: { x: number, y: number, value: string, layerId?: string } | null;
  brushSize?: number;
  brushColor?: string;
  primaryOpacity?: number;
  strokeWidth?: number;
  secondaryColor?: string;
  secondaryOpacity?: number;
  hexToRgba?: (hex: string, opacity: number) => string;
  hiddenTextInputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export const useTextRendering = (
  draftTextCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: TextRenderingOptions
) => {
  const { textEditor } = options;

  useEffect(() => {
    const canvas = draftTextCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (!textEditor) return;
  }, [textEditor, draftTextCanvasRef]);
};

