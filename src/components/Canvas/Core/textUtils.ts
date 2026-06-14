import type { Point } from '../types';
import { toolState } from '../../../tools/toolState';

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
  updateLayer?: (id: string, updates: any) => void
) => {
  hiddenTextInputRef.current?.blur();

  if (textEditor) {
    const value = textEditor.value;
    if (textEditor.layerId) {
      if (updateLayer) {
        updateLayer(textEditor.layerId, {
          textContent: value,
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
        fontSize: brushSize * 2,
        color: hexToRgba(brushColor, primaryOpacity),
        strokeColor: strokeWidth > 0 ? hexToRgba(secondaryColor, secondaryOpacity) : undefined,
        strokeWidth: strokeWidth,
        isVertical: toolState._lastTextTool === 'vertical_text',
        visible: true, opacity: 1
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
