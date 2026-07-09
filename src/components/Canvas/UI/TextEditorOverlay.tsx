import React from 'react';
import { useStore } from '../../../store/useStore';
import { Z_INDEX } from '../../../constants/zIndex';
import { loadGoogleFont } from '../../../utils/canvasUtils';
import { findLayerById } from '../../../utils/layerUtils';
import { toolState } from '../../../tools/toolState';

interface TextEditorOverlayProps {
  textEditor: { x: number, y: number, value: string, layerId?: string } | null;
  setTextEditor: React.Dispatch<React.SetStateAction<{ x: number, y: number, value: string, layerId?: string } | null>>;
  hiddenTextInputRef: React.RefObject<HTMLTextAreaElement | null>;
  draftTextCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  documentSize: { w: number, h: number };
  commitText: () => void;
  cancelText: () => void;
}

export const TextEditorOverlay: React.FC<TextEditorOverlayProps> = ({
  textEditor,
  setTextEditor,
  hiddenTextInputRef,
  draftTextCanvasRef,
  documentSize,
  commitText,
  cancelText
}) => {
  const brushSize = useStore(state => state.brushSize);
  const brushColor = useStore(state => state.brushColor);
  const layers = useStore(state => state.layers);
  const textAlign = useStore(state => state.textAlign);
  const textFontWeight = useStore(state => state.textFontWeight);
  const textFontStyle = useStore(state => state.textFontStyle);

  const defaultFontFamily = useStore(state => state.textFontFamily);
  const activeLayer = textEditor?.layerId ? findLayerById(layers, textEditor.layerId) : null;
  const hasCustomFont = !!activeLayer?.fontChecksum;
  const editorFamily = activeLayer?.fontFamily || defaultFontFamily;

  React.useEffect(() => {
    if (textEditor && editorFamily && !hasCustomFont) {
      loadGoogleFont(editorFamily);
    }
  }, [textEditor, editorFamily, hasCustomFont]);

  if (!textEditor) return null;

  const isVertical = activeLayer?.isVertical || toolState._lastTextTool === 'vertical_text';
  const customFontKey = hasCustomFont ? `pdf-font-${activeLayer.fontChecksum}` : '';
  const cleanFamily = activeLayer?.fontFamily || '';

  const editorFontFamily = hasCustomFont
    ? `"${customFontKey}", "${cleanFamily}", "Noto Sans Devanagari", "Mangal", "Arial Unicode MS", sans-serif`
    : `"${editorFamily}", "Noto Sans Devanagari", "Mangal", "Arial Unicode MS", "Noto Sans", sans-serif, Arial`;

  const fs = brushSize * 2;
  const lines = textEditor.value.split('\n');
  const padding = 10;

  let width = 100;
  let height = 40;

  if (isVertical) {
    let maxLineLength = 1;
    lines.forEach(line => {
      if (line.length > maxLineLength) maxLineLength = line.length;
    });
    width = lines.length * fs * 1.2 + padding * 2;
    height = maxLineLength * fs + padding * 2;
  } else {
    let maxWidth = 10;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = `${fs}px ${editorFontFamily}`;
      lines.forEach((line) => {
        const w = ctx.measureText(line).width;
        if (w > maxWidth) maxWidth = w;
      });
    } else {
      lines.forEach(line => {
        const w = line.length * fs * 0.6;
        if (w > maxWidth) maxWidth = w;
      });
    }
    width = maxWidth + padding * 2 + 10;
    height = lines.length * fs + padding;
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    const val = target.value;
    const start = target.selectionStart;
    const end = target.selectionEnd;

    setTextEditor(prev => {
      if (!prev) return null;
      return { ...prev, value: val };
    });

    requestAnimationFrame(() => {
      if (hiddenTextInputRef.current) {
        hiddenTextInputRef.current.setSelectionRange(start, end);
      }
    });
  };

  return (
    <>
      <textarea
        ref={hiddenTextInputRef}
        className="text-editor-input"
        autoFocus
        style={{
          position: 'absolute',
          left: textEditor.x - padding,
          top: textEditor.y,
          width: width,
          height: height,
          fontSize: `${fs}px`,
          fontFamily: editorFontFamily,
          fontWeight: activeLayer?.fontWeight || textFontWeight || 'normal',
          fontStyle: activeLayer?.fontStyle || textFontStyle || 'normal',
          color: activeLayer?.color || brushColor,
          caretColor: activeLayer?.color || brushColor,
          textAlign: activeLayer?.textAlign || textAlign || 'left',
          lineHeight: 1.2,
          padding: `${padding}px`,
          boxSizing: 'border-box',
          writingMode: isVertical ? 'vertical-rl' : 'horizontal-tb',
          zIndex: Z_INDEX.textEditorInput,
          whiteSpace: 'pre'
        }}
        value={textEditor.value}
        onChange={handleChange}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="sentences"
        spellCheck={false}
        inputMode="text"
        wrap="off"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      />
      <canvas
        ref={draftTextCanvasRef}
        width={documentSize.w}
        height={documentSize.h}
        className="layer-canvas visible"
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%', height: '100%',
          opacity: 1,
          zIndex: Z_INDEX.systemAlert, // Render above everything while typing
          mixBlendMode: 'normal',
          pointerEvents: 'none'
        }}
      />
      <div
        className="text-tool-interface"
        style={{
          position: 'absolute',
          left: textEditor.x,
          top: textEditor.y - 45,
          zIndex: Z_INDEX.textEditorSubmit,
          display: 'flex',
          gap: '8px',
          pointerEvents: 'auto',
          background: '#222',
          padding: '6px',
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          border: '1px solid #444'
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="text-action-btn confirm"
          onClick={(e) => { e.stopPropagation(); commitText(); }}
          style={{ background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          ✓
        </button>
        <button
          className="text-action-btn cancel"
          onClick={(e) => { e.stopPropagation(); cancelText(); }}
          style={{ background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          ✕
        </button>
      </div>
    </>
  );
};

