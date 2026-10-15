import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import { findLayerById } from '../../utils/layerUtils';
import { FADE_MODES, compositeFade, paintFadeResult } from '../../utils/fadeUtils';
import './Dialogs.css';

/**
 * Edit > Fade... — Photoshop-style fade of the most recently applied filter.
 * Re-composites the filter result over the pre-filter pixels with a live
 * opacity slider and blend-mode picker. Preview paints straight onto the
 * layer canvas; nothing is committed until OK.
 */
export const FadeDialog: React.FC = () => {
  const isFadeDialogOpen = useStore((s) => s.isFadeDialogOpen);
  const setIsFadeDialogOpen = useStore((s) => s.setIsFadeDialogOpen);
  const lastFilter = useStore((s) => s.lastFilter);
  const setLastFilter = useStore((s) => s.setLastFilter);
  const updateLayer = useStore((s) => s.updateLayer);
  const recordHistory = useStore((s) => s.recordHistory);
  const layers = useStore((s) => s.layers);

  const [opacity, setOpacity] = useState(100);
  const [mode, setMode] = useState<GlobalCompositeOperation>('source-over');
  const dialogRef = useRef<HTMLDivElement>(null);
  const dragPos = useRef({ x: 0, y: 0 });

  // Fresh controls each time the dialog opens.
  useEffect(() => {
    if (isFadeDialogOpen) {
      setOpacity(100);
      setMode('source-over');
    }
  }, [isFadeDialogOpen]);

  const paintCurrent = useCallback(
    (op: number, m: GlobalCompositeOperation): HTMLCanvasElement | null => {
      if (!lastFilter) return null;
      const canvas = document.querySelector(
        `canvas[data-layer-id="${lastFilter.layerId}"]`
      ) as HTMLCanvasElement;
      if (!canvas) return null;
      const layer = findLayerById(layers, lastFilter.layerId);
      const offX = layer?.position.x || 0;
      const offY = layer?.position.y || 0;
      const faded = compositeFade(lastFilter.before, lastFilter.after, op / 100, m);
      paintFadeResult(canvas, lastFilter.before, faded, lastFilter.selection, offX, offY);
      return faded;
    },
    [lastFilter, layers]
  );

  // Live preview.
  useEffect(() => {
    if (!isFadeDialogOpen || !lastFilter) return;
    paintCurrent(opacity, mode);
  }, [isFadeDialogOpen, lastFilter, opacity, mode, paintCurrent]);

  if (!isFadeDialogOpen || !lastFilter) return null;

  const handleCancel = () => {
    // Restore the exact post-filter state (opacity 100, Normal).
    paintCurrent(100, 'source-over');
    setIsFadeDialogOpen(false);
  };

  const handleOk = () => {
    const faded = paintCurrent(opacity, mode);
    const canvas = document.querySelector(
      `canvas[data-layer-id="${lastFilter.layerId}"]`
    ) as HTMLCanvasElement;
    if (canvas) {
      updateLayer(lastFilter.layerId, { dataUrl: canvas.toDataURL() });
      recordHistory(`Fade: ${lastFilter.filterLabel}`);
    }
    if (faded) {
      // A subsequent Fade starts from the faded result, like Photoshop.
      const fctx = faded.getContext('2d')!;
      setLastFilter({
        ...lastFilter,
        after: fctx.getImageData(0, 0, faded.width, faded.height),
      });
    }
    setIsFadeDialogOpen(false);
  };

  const onPointerDown = (e: React.PointerEvent) => {
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
  };

  return (
    <div className="dialog-overlay">
      <div ref={dialogRef} className="dialog-content" style={{ maxWidth: '22rem' }}>
        <div className="dialog-header draggable-header" onPointerDown={onPointerDown}>
          <h2>Fade {lastFilter.filterLabel}</h2>
          <button className="dialog-close" onClick={handleCancel} aria-label="Close">
            <LucideIcons.X size={16} />
          </button>
        </div>
        <div className="dialog-body" style={{ gap: '0.75rem' }}>
          <div className="dialog-control-group">
            <label>Opacity: {opacity}%</label>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={opacity}
              onChange={(e) => setOpacity(parseInt(e.target.value, 10))}
            />
          </div>
          <div className="dialog-control-group">
            <label>Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as GlobalCompositeOperation)}
            >
              {FADE_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <p style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: '#888', textAlign: 'center' }}>
            Adjust the strength of the last filter ({lastFilter.filterLabel}) without re-running it.
          </p>
        </div>
        <div className="dialog-footer">
          <button className="btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleOk}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
