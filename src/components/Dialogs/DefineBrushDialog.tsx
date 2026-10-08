import React, { useState, useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import './Dialogs.css';

const DefineBrushDialog: React.FC = () => {
  const isOpen = useStore((s) => s.isDefineBrushDialogOpen);
  const setIsOpen = useStore((s) => s.setIsDefineBrushDialogOpen);
  const addBrushPreset = useStore((s) => s.addBrushPreset);
  const addAlert = useStore((s) => s.addAlert);

  // Seed the dialog with the user's current brush settings.
  const seedSize = useStore((s) => s.brushSize);
  const seedColor = useStore((s) => s.brushColor);
  const seedHardness = useStore((s) => s.toolHardness);
  const seedOpacity = useStore((s) => s.primaryOpacity);

  const [name, setName] = useState('');
  const [size, setSize] = useState(seedSize);
  const [color, setColor] = useState(seedColor);
  const [hardness, setHardness] = useState(seedHardness);
  const [opacity, setOpacity] = useState(seedOpacity);

  // Keep the editor's live values in sync when (re)opened.
  React.useEffect(() => {
    if (isOpen) {
      setName('');
      setSize(seedSize);
      setColor(seedColor);
      setHardness(seedHardness);
      setOpacity(seedOpacity);
    }
  }, [isOpen, seedSize, seedColor, seedHardness, seedOpacity]);

  const canSave = name.trim().length > 0;

  const previewStyle = useMemo(() => {
    const radius = Math.max(4, Math.min(60, size / 2));
    const soft = Math.max(0, Math.min(1, hardness / 100));
    const inner = radius * soft;
    const outer = radius;
    const alpha = Math.max(0.05, Math.min(1, opacity));
    const c = color || '#000000';
    return {
      width: '120px',
      height: '120px',
      borderRadius: '50%',
      background: `radial-gradient(circle, ${c} ${Math.round(
        (inner / outer) * 100,
      )}% , ${c}00 100%)`,
      boxShadow: `0 0 0 1px rgba(255,255,255,0.12) inset`,
      opacity: alpha,
    } as React.CSSProperties;
  }, [size, hardness, opacity, color]);

  const handleSave = () => {
    if (!canSave) return;
    addBrushPreset({
      name: name.trim(),
      size: Math.round(size),
      color,
      hardness: Math.round(hardness),
      opacity: Number(opacity.toFixed(2)),
    });
    addAlert({ type: 'success', message: `Brush preset "${name.trim()}" saved.` });
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay define-brush-overlay" onClick={() => setIsOpen(false)}>
      <div className="dialog-content define-brush-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header define-brush-header">
          <div className="define-brush-title-group">
            <LucideIcons.Brush size={18} />
            <h3>New Brush Preset</h3>
          </div>
          <button className="dialog-close" onClick={() => setIsOpen(false)} title="Close">
            <LucideIcons.X size={18} />
          </button>
        </div>

        <div className="dialog-body define-brush-body">
          <div className="define-brush-preview">
            <div className="define-brush-preview-canvas">
              <div style={previewStyle} />
            </div>
            <span className="define-brush-preview-label">Preview</span>
          </div>

          <div className="define-brush-controls">
            <div className="db-field">
              <label className="db-label">Name</label>
              <input
                className="db-input"
                value={name}
                placeholder="My Brush"
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
              />
            </div>

            <div className="db-field">
              <label className="db-label">
                <span>Size</span>
                <span className="db-value">{Math.round(size)} px</span>
              </label>
              <input
                type="range"
                min={1}
                max={500}
                value={size}
                className="db-range"
                onChange={(e) => setSize(Number(e.target.value))}
              />
            </div>

            <div className="db-field">
              <label className="db-label">
                <span>Hardness</span>
                <span className="db-value">{Math.round(hardness)}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={hardness}
                className="db-range"
                onChange={(e) => setHardness(Number(e.target.value))}
              />
            </div>

            <div className="db-field">
              <label className="db-label">
                <span>Opacity</span>
                <span className="db-value">{Math.round(opacity * 100)}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(opacity * 100)}
                className="db-range"
                onChange={(e) => setOpacity(Number(e.target.value) / 100)}
              />
            </div>

            <div className="db-field db-field-row">
              <label className="db-label">Color</label>
              <div className="db-color-row">
                <input
                  type="color"
                  className="db-color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
                <span className="db-color-hex">{color.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="dialog-footer define-brush-footer">
          <button className="dialog-btn" onClick={() => setIsOpen(false)}>Cancel</button>
          <button className="dialog-btn primary" disabled={!canSave} onClick={handleSave}>
            <LucideIcons.Save size={15} /> Save Preset
          </button>
        </div>
      </div>
    </div>
  );
};

export { DefineBrushDialog };
