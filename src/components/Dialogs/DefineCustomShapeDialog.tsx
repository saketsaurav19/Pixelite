import React, { useState, useEffect, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { CustomShapePreset } from '../../store/types';
import './Dialogs.css';

const DefineCustomShapeDialog: React.FC = () => {
  const isOpen = useStore((s) => s.isDefineCustomShapeDialogOpen);
  const setIsOpen = useStore((s) => s.setIsDefineCustomShapeDialogOpen);
  const customShapes = useStore((s) => s.customShapes);
  const addCustomShapePreset = useStore((s) => s.addCustomShapePreset);
  const removeCustomShapePreset = useStore((s) => s.removeCustomShapePreset);
  const addAlert = useStore((s) => s.addAlert);

  const [name, setName] = useState('');
  const [seedReady, setSeedReady] = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);

  // Seed once when dialog opens.
  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setSeedReady(false);

    // Small delay so the DOM paints before we read the canvas.
    const t = setTimeout(() => {
      const state = useStore.getState();
      const layer = state.layers.find((l) => l.id === state.activeLayerId);
      if (layer?.type === 'shape' && layer.shapeData?.points && layer.shapeData.points.length > 0) {
        setSeedReady(true);
        drawPreview(previewRef.current, layer.shapeData);
      }
    }, 50);
    return () => clearTimeout(t);
  }, [isOpen]);

  const canSave = name.trim().length > 0 && seedReady;

  const handleSave = () => {
    if (!canSave) return;
    const state = useStore.getState();
    const layer = state.layers.find((l) => l.id === state.activeLayerId);
    if (!layer?.shapeData?.points) return;
    addCustomShapePreset({
      name: name.trim(),
      shapeData: {
        points: layer.shapeData.points,
        closed: layer.shapeData.closed ?? true,
      },
    });
    addAlert({ type: 'success', message: `Custom shape "${name.trim()}" saved.` });
    setIsOpen(false);
  };

  const handleDelete = (id: string, shapeName: string) => {
    removeCustomShapePreset(id);
    addAlert({ type: 'info', message: `Custom shape "${shapeName}" deleted.` });
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay define-shape-overlay" onClick={() => setIsOpen(false)}>
      <div className="dialog-content define-shape-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header define-shape-header">
          <div className="define-shape-title-group">
            <LucideIcons.Pentagon size={18} />
            <h3>New Custom Shape</h3>
          </div>
          <button className="dialog-close" onClick={() => setIsOpen(false)} title="Close">
            <LucideIcons.X size={18} />
          </button>
        </div>

        <div className="dialog-body define-shape-body">
          <div className="define-shape-preview">
            <div className="define-shape-preview-canvas">
              <canvas ref={previewRef} width={120} height={120} />
            </div>
            <span className="define-shape-preview-label">Preview</span>
          </div>

          <div className="define-shape-controls">
            {!seedReady ? (
              <div className="define-shape-empty">
                <LucideIcons.AlertCircle size={20} />
                <p>Select a shape layer with custom path points first, then use this dialog to save it as a preset.</p>
              </div>
            ) : (
              <div className="ds-field">
                <label className="ds-label">Name</label>
                <input
                  className="ds-input"
                  value={name}
                  placeholder="My Custom Shape"
                  autoFocus
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {customShapes.length > 0 && (
          <div className="define-shape-list">
            <div className="define-shape-list-header">
              <span className="define-shape-list-title">Saved Shapes ({customShapes.length})</span>
            </div>
            <div className="define-shape-list-items">
              {customShapes.map((s: CustomShapePreset) => (
                <div key={s.id} className="define-shape-list-item">
                  <span className="define-shape-list-name">{s.name}</span>
                  <span className="define-shape-list-meta">{s.shapeData.points.length} points</span>
                  <button
                    className="define-shape-list-delete"
                    onClick={() => handleDelete(s.id, s.name)}
                    title="Delete"
                  >
                    <LucideIcons.Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="dialog-footer define-shape-footer">
          <button className="dialog-btn" onClick={() => setIsOpen(false)}>Cancel</button>
          <button className="dialog-btn primary" disabled={!canSave} onClick={handleSave}>
            <LucideIcons.Save size={15} /> Save Preset
          </button>
        </div>
      </div>
    </div>
  );
};

function drawPreview(canvas: HTMLCanvasElement | null, shapeData: any) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const size = 120;
  canvas.width = size;
  canvas.height = size;

  // Checkerboard background.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  const check = 8;
  ctx.fillStyle = '#e0e0e0';
  for (let y = 0; y < size; y += check) {
    for (let x = 0; x < size; x += check) {
      if ((Math.floor(x / check) + Math.floor(y / check)) % 2 === 0) {
        ctx.fillRect(x, y, check, check);
      }
    }
  }

  const pts = shapeData.points;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const scale = Math.min((size - 20) / w, (size - 20) / h);
  const offsetX = (size - w * scale) / 2 - minX * scale;
  const offsetY = (size - h * scale) / 2 - minY * scale;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  if (shapeData.closed) ctx.closePath();

  if (shapeData.fill && shapeData.fill !== 'transparent') {
    ctx.fillStyle = shapeData.fill;
    ctx.fill();
  }
  if (shapeData.stroke && shapeData.stroke !== 'transparent' && shapeData.strokeWidth > 0) {
    ctx.strokeStyle = shapeData.stroke;
    ctx.lineWidth = shapeData.strokeWidth / scale;
    ctx.stroke();
  }

  ctx.restore();
}

export { DefineCustomShapeDialog };
