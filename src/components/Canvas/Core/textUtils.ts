import type { Point } from '../types';
import { toolState } from '../../../tools/toolState';

const measureTextSize = (
  value: string,
  fontSize: number,
  isVertical: boolean,
  fontFamily = 'sans-serif',
  fontWeight = 'normal',
  fontStyle = 'normal'
) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const cleanFamily = fontFamily.replace(/^[A-Z]{6}\+/, '');
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${cleanFamily}", "Noto Sans", sans-serif`;
  const lines = value.split('\n');
  
  if (isVertical) {
    const lineHeights = lines.map(line => line.length * fontSize);
    const height = Math.max(10, ...lineHeights);
    const width = Math.max(10, lines.length * fontSize * 1.2);
    return { width, height };
  } else {
    let maxW = 10;
    lines.forEach((line) => {
      const w = ctx.measureText(line).width;
      if (w > maxW) maxW = w;
    });
    const height = Math.max(10, lines.length * fontSize * 1.2);
    return { width: maxW + 16, height }; // 16px padding
  }
};

export const commitText = (
  textEditor: (Point & { value: string; layerId?: string }) | null,
  brushSize: number,
  brushColor: string,
  primaryOpacity: number,
  strokeWidth: number,
  secondaryColor: string,
  secondaryOpacity: number,
  hexToRgba: (hex: string, alpha: number) => string,
  addLayer: (layer: any) => void,
  recordHistory: (label: string) => void,
  setTextEditor: (val: any) => void,
  hiddenTextInputRef: React.RefObject<HTMLTextAreaElement | null>,
  textFontFamily: string,
  textAlign: 'left' | 'center' | 'right',
  textFontWeight: string,
  textFontStyle: string,
  updateLayer?: (id: string, updates: any) => void
) => {
  hiddenTextInputRef.current?.blur();

  if (textEditor) {
    const value = textEditor.value;
    const fontSize = brushSize * 2;
    const isVertical = toolState._lastTextTool === 'vertical_text';
    const size = measureTextSize(value, fontSize, isVertical, textFontFamily, textFontWeight, textFontStyle);

    if (textEditor.layerId) {
      if (updateLayer) {
        updateLayer(textEditor.layerId, {
          textContent: value,
          width: size.width,
          height: size.height,
          isModified: true,
          name: value.trim().length > 20 ? value.trim().substring(0, 20) + '...' : value.trim()
        });
        recordHistory('Edit Text Layer');
      }
    } else if (value.trim()) {
      const typedText = value.trim();
      addLayer({
        name: typedText.length > 20 ? typedText.substring(0, 20) + '...' : typedText,
        type: 'text',
        textContent: value,
        position: { x: textEditor.x, y: textEditor.y },
        width: size.width,
        height: size.height,
        fontSize: fontSize,
        color: hexToRgba(brushColor, primaryOpacity),
        strokeColor: strokeWidth > 0 ? hexToRgba(secondaryColor, secondaryOpacity) : undefined,
        strokeWidth: strokeWidth,
        isVertical: isVertical,
        fontFamily: textFontFamily,
        textAlign: textAlign,
        fontWeight: textFontWeight,
        fontStyle: textFontStyle as any,
        visible: true,
        opacity: 1
      });
      recordHistory('Add Text Layer');
    }
  }
  setTextEditor(null);
};

export const cancelText = (
  setTextEditor: (val: any) => void,
  hiddenTextInputRef: React.RefObject<HTMLTextAreaElement | null>
) => {
  hiddenTextInputRef.current?.blur();
  setTextEditor(null);
};

export const recalculateTextLayerBounds = (
  layer: any,
  fontFamily: string,
  fontSize: number,
  fontWeight: string,
  fontStyle: string
) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  const cleanFamily = fontFamily.replace(/^[A-Z]{6}\+/, '');
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${cleanFamily}", "Noto Sans", sans-serif`;
  
  const lines = (layer.textContent || '').split('\n');
  const isVertical = !!layer.isVertical;

  let width = 100;
  let height = 40;

  if (isVertical) {
    const lineHeights = lines.map(line => line.length * fontSize);
    height = Math.max(10, ...lineHeights);
    width = Math.max(10, lines.length * fontSize * 1.2);
  } else {
    let maxW = 10;
    lines.forEach((line) => {
      const w = ctx.measureText(line).width;
      if (w > maxW) maxW = w;
    });
    height = Math.max(10, lines.length * fontSize * 1.2);
    width = maxW + 16; // 16px padding
  }

  return { width, height };
};
