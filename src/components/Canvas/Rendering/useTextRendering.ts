import { useEffect } from 'react';
import { toolState } from '../../../tools/toolState';
import { useStore } from '../../../store/useStore';
import { findLayerById } from '../../../utils/layerUtils';

/**
 * Options for the useTextRendering hook.
 */
interface TextRenderingOptions {
  textEditor: { x: number, y: number, value: string, layerId?: string } | null; // Current text editor state (position and content)
  brushSize: number; // Font size (calculated from brush size)
  brushColor: string; // Primary text color
  primaryOpacity: number; // Opacity of the text
  strokeWidth: number; // Width of the text outline
  secondaryColor: string; // Color of the text outline
  secondaryOpacity: number; // Opacity of the text outline
  hexToRgba: (hex: string, opacity: number) => string; // Color conversion utility
  hiddenTextInputRef: React.RefObject<HTMLTextAreaElement | null>;
}

/**
 * A custom hook that manages the real-time rendering of text on a temporary canvas.
 * It provides immediate visual feedback while the user is typing, including an animated cursor.
 */
export const useTextRendering = (
  draftTextCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: TextRenderingOptions
) => {
  const {
    textEditor, brushSize, brushColor, primaryOpacity, strokeWidth,
    secondaryColor, secondaryOpacity, hexToRgba, hiddenTextInputRef
  } = options;

  useEffect(() => {
    if (!textEditor) return;

    let animationFrameId: number;
    const canvas = draftTextCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderLoop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const fs = brushSize * 2;
      ctx.fillStyle = hexToRgba(brushColor, primaryOpacity);

      const layers = useStore.getState().layers;
      const activeLayer = textEditor.layerId ? findLayerById(layers, textEditor.layerId) : null;
      const isVertical = activeLayer?.isVertical || toolState._lastTextTool === 'vertical_text';

      const hasCustomFont = !!activeLayer?.fontChecksum;
      const customFontKey = hasCustomFont ? `pdf-font-${activeLayer.fontChecksum}` : '';
      const cleanFamily = activeLayer?.fontFamily || '';

      const draftFontFamily = hasCustomFont
        ? `"${customFontKey}", "${cleanFamily}", "Noto Sans Devanagari", "Mangal", "Arial Unicode MS", sans-serif`
        : `"Noto Sans Devanagari", "Mangal", "Arial Unicode MS", "Kohinoor Devanagari", "Devanagari MT", "Noto Sans", sans-serif, Arial`;

      ctx.font = `${fs}px ${draftFontFamily}`;

      const lines = textEditor.value.split('\n');
      let maxWidth = 10;
      lines.forEach((line) => {
        const w = ctx.measureText(line).width;
        if (w > maxWidth) maxWidth = w;
      });

      const padding = 10;
      ctx.strokeStyle = '#aaaaaa';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(textEditor.x - padding, textEditor.y, maxWidth + padding * 2 + 10, lines.length * fs + padding);
      ctx.setLineDash([]);

      lines.forEach((line, i) => {
        if (isVertical) {
          const chars = line.split('');
          const xPos = textEditor.x + i * fs * 1.2;
          chars.forEach((char, j) => {
            const yPos = textEditor.y + (j + 1) * fs;
            if (strokeWidth > 0) {
              ctx.strokeStyle = hexToRgba(secondaryColor, secondaryOpacity);
              ctx.lineWidth = strokeWidth;
              ctx.strokeText(char, xPos, yPos);
            }
            ctx.fillText(char, xPos, yPos);
          });
        } else {
          const yPos = textEditor.y + (i + 1) * fs;
          if (strokeWidth > 0) {
            ctx.strokeStyle = hexToRgba(secondaryColor, secondaryOpacity);
            ctx.lineWidth = strokeWidth;
            ctx.strokeText(line, textEditor.x, yPos);
          }
          ctx.fillText(line, textEditor.x, yPos);
        }
      });

      // Cursor calculation
      const input = hiddenTextInputRef.current;
      const cursorIdx = input ? input.selectionStart : textEditor.value.length;

      // Find which line and column the cursor is on
      let currentLineIdx = 0;
      let currentColIdx = 0;
      let charAccumulator = 0;

      for (let i = 0; i < lines.length; i++) {
        const lineLength = lines[i].length;
        if (cursorIdx >= charAccumulator && cursorIdx <= charAccumulator + lineLength) {
          currentLineIdx = i;
          currentColIdx = cursorIdx - charAccumulator;
          break;
        }
        charAccumulator += lineLength + 1; // +1 for the '\n' character
      }

      let cursorX = textEditor.x;
      let cursorY = textEditor.y;

      if (isVertical) {
        cursorX = textEditor.x + currentLineIdx * fs * 1.2;
        cursorY = textEditor.y + currentColIdx * fs;
      } else {
        const lineText = lines[currentLineIdx].substring(0, currentColIdx);
        const textWidth = ctx.measureText(lineText).width;
        cursorX = textEditor.x + textWidth;
        cursorY = textEditor.y + currentLineIdx * fs;
      }

      // Render custom blinking caret
      const time = Date.now();
      if (Math.floor(time / 500) % 2 === 0) {
        ctx.beginPath();
        if (isVertical) {
          ctx.moveTo(cursorX, cursorY + fs * 0.2);
          ctx.lineTo(cursorX + fs, cursorY + fs * 0.2);
        } else {
          ctx.moveTo(cursorX + 2, cursorY + fs * 0.2);
          ctx.lineTo(cursorX + 2, cursorY + fs * 1.2);
        }
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [textEditor, brushSize, brushColor, primaryOpacity, strokeWidth, secondaryColor, secondaryOpacity, hexToRgba, draftTextCanvasRef, hiddenTextInputRef]);
};

