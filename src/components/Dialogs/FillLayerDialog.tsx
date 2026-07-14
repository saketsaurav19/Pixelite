import React, { useCallback, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import { hexToRgba } from '../../utils/canvasUtils';
import { findLayerById } from '../../utils/layerUtils';
import ColorPicker from '../shared/ColorPicker';
import './Dialogs.css';

interface FillLayerDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FillLayerDialog: React.FC<FillLayerDialogProps> = ({ isOpen, onClose }) => {
  const [fillColor, setFillColor] = React.useState('#ffffff');
  const [fillOpacity, setFillOpacity] = React.useState(1);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dragPos = useRef({ x: 0, y: 0 });

  const rasterTypes = new Set(['paint', 'image']);

  if (!isOpen) return null;

  const handleFill = () => {
    const state = useStore.getState();
    const targetId = state.activeLayerId;
    if (!targetId) return;

    const activeLayer = findLayerById(state.layers, targetId);
    let fillLayerId = targetId;

    if (!activeLayer || !rasterTypes.has(activeLayer.type || 'paint')) {
      state.addLayer({
        name: 'Filled Layer',
        type: 'paint',
        width: state.documentSize.w,
        height: state.documentSize.h,
      });
      fillLayerId = useStore.getState().activeLayerId!;
    }

    const canvas = document.querySelector(`canvas[data-layer-id="${fillLayerId}"]`) as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.fillStyle = hexToRgba(fillColor, fillOpacity);

    if (state.lassoPaths.length > 0) {
      ctx.beginPath();
      state.lassoPaths.forEach(path => {
        if (path.length < 3) return;
        ctx.moveTo(path[0].x, path[0].y);
        path.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
      });
      ctx.clip('evenodd');
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (state.selectionRect) {
      ctx.fillRect(state.selectionRect.x, state.selectionRect.y, state.selectionRect.w, state.selectionRect.h);
    } else {
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.restore();
    state.updateLayer(fillLayerId, { dataUrl: canvas.toDataURL() });
    state.recordHistory('Fill Layer');
    onClose();
  };

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const header = e.currentTarget as HTMLElement;
    const content = header.parentElement;
    if (!content) return;

    header.setPointerCapture(e.pointerId);
    const startX = e.clientX - dragPos.current.x;
    const startY = e.clientY - dragPos.current.y;

    const onMove = (me: PointerEvent) => {
      dragPos.current.x = me.clientX - startX;
      dragPos.current.y = me.clientY - startY;
      content.style.transform = `translate(${dragPos.current.x}px, ${dragPos.current.y}px)`;
    };

    const onUp = () => {
      header.releasePointerCapture(e.pointerId);
      header.removeEventListener('pointermove', onMove);
      header.removeEventListener('pointerup', onUp);
    };

    header.addEventListener('pointermove', onMove);
    header.addEventListener('pointerup', onUp);
  }, []);

  return (
    <div className="dialog-overlay fill-layer-overlay">
      <div ref={dialogRef} className="dialog-content" style={{ maxWidth: '24rem' }}>
        <div className="dialog-header draggable-header" onPointerDown={onPointerDown}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 500 }}>Fill Layer</h3>
          <button className="dialog-close" onClick={onClose}>
            <LucideIcons.X size={18} />
          </button>
        </div>
        <div className="dialog-body" style={{ gap: '0.75rem' }}>
          <ColorPicker
            label="Fill Color"
            color={fillColor}
            opacity={fillOpacity}
            onColorChange={setFillColor}
            onOpacityChange={setFillOpacity}
          />
        </div>
        <div className="dialog-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleFill}>Fill Layer</button>
        </div>
      </div>
    </div>
  );
};
