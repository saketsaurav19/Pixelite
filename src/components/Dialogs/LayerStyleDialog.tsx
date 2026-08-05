import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { motion, useDragControls } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { findLayerById } from '../../utils/layerUtils';
import './Dialogs.css';

export const LayerStyleDialog: React.FC = () => {
  const dragControls = useDragControls();
  const {
    isLayerStyleDialogOpen,
    setIsLayerStyleDialogOpen,
    layerStyleActiveTab,
    setLayerStyleActiveTab,
    activeLayerId,
    updateLayer,
    recordHistory,
    layers
  } = useStore();

  const activeLayer = activeLayerId ? findLayerById(layers, activeLayerId) : undefined;

  // Blending Options
  const [opacity, setOpacity] = useState(100);
  const [blendMode, setBlendMode] = useState<any>('source-over');

  // Drop Shadow Options
  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [shadowColor, setShadowColor] = useState('#000000');
  const [shadowOpacity, setShadowOpacity] = useState(75);
  const [shadowAngle, setShadowAngle] = useState(120);
  const [shadowDistance, setShadowDistance] = useState(5);
  const [shadowSize, setShadowSize] = useState(5);

  // Stroke Options
  const [strokeEnabled, setStrokeEnabled] = useState(false);
  const [strokeSize, setStrokeSize] = useState(3);
  const [strokeColor, setStrokeColor] = useState('#ff0000');
  const [strokeOpacity, setStrokeOpacity] = useState(100);

  // Backup of original canvas pixels
  const [backupCanvas, setBackupCanvas] = useState<HTMLCanvasElement | null>(null);

  // Mobile layout detection
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Set defaults when opening
  useEffect(() => {
    if (!isLayerStyleDialogOpen || !activeLayer) return;

    setOpacity(Math.round((activeLayer.opacity ?? 1) * 100));
    setBlendMode(activeLayer.blendMode || 'source-over');

    // Default other settings
    setShadowEnabled(false);
    setShadowColor('#000000');
    setShadowOpacity(75);
    setShadowAngle(120);
    setShadowDistance(5);
    setShadowSize(5);

    setStrokeEnabled(false);
    setStrokeSize(3);
    setStrokeColor('#ff0000');
    setStrokeOpacity(100);

    // Save backup canvas of the layer's original state
    const layerCanvas = document.querySelector(`canvas[data-layer-id="${activeLayer.id}"]`) as HTMLCanvasElement;
    if (layerCanvas) {
      const backup = document.createElement('canvas');
      backup.width = layerCanvas.width;
      backup.height = layerCanvas.height;
      const backupCtx = backup.getContext('2d');
      if (backupCtx) {
        backupCtx.drawImage(layerCanvas, 0, 0);
        setBackupCanvas(backup);
      }
    }
  }, [isLayerStyleDialogOpen, activeLayerId]);

  // Utility to convert hex to rgb string
  const hexToRgb = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return `${r}, ${g}, ${b}`;
  };

  // Render preview on the DOM canvas in real-time
  useEffect(() => {
    if (!isLayerStyleDialogOpen || !activeLayerId || !backupCanvas) return;

    const layerCanvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
    if (!layerCanvas) return;

    const ctx = layerCanvas.getContext('2d');
    if (!ctx) return;

    // 1. Clear layer and paint shadow/stroke
    ctx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);

    // Draw shadow first (behind content)
    if (shadowEnabled) {
      ctx.save();
      ctx.shadowColor = `rgba(${hexToRgb(shadowColor)}, ${shadowOpacity / 100})`;
      ctx.shadowBlur = shadowSize;
      ctx.shadowOffsetX = shadowDistance * Math.cos((shadowAngle * Math.PI) / 180);
      ctx.shadowOffsetY = shadowDistance * Math.sin((shadowAngle * Math.PI) / 180);
      ctx.drawImage(backupCanvas, 0, 0);
      ctx.restore();
    }

    // Draw stroke (behind main content)
    if (strokeEnabled && strokeSize > 0) {
      const temp = document.createElement('canvas');
      temp.width = layerCanvas.width;
      temp.height = layerCanvas.height;
      const tCtx = temp.getContext('2d')!;

      // Outline mask stamp drawing
      const steps = 32;
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const dx = Math.round(Math.cos(angle) * strokeSize);
        const dy = Math.round(Math.sin(angle) * strokeSize);
        tCtx.drawImage(backupCanvas, dx, dy);
      }

      tCtx.globalCompositeOperation = 'source-in';
      tCtx.fillStyle = `rgba(${hexToRgb(strokeColor)}, ${strokeOpacity / 100})`;
      tCtx.fillRect(0, 0, layerCanvas.width, layerCanvas.height);

      ctx.drawImage(temp, 0, 0);
    }

    // Draw original image on top
    ctx.drawImage(backupCanvas, 0, 0);

    // Update store state for opacity and blendMode in real-time so viewport updates opacity/blends
    updateLayer(activeLayerId, {
      opacity: opacity / 100,
      blendMode: blendMode
    });

  }, [
    opacity,
    blendMode,
    shadowEnabled,
    shadowColor,
    shadowOpacity,
    shadowAngle,
    shadowDistance,
    shadowSize,
    strokeEnabled,
    strokeSize,
    strokeColor,
    strokeOpacity,
    backupCanvas
  ]);

  if (!isLayerStyleDialogOpen || !activeLayer) return null;

  const handleApply = () => {
    const layerCanvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
    if (layerCanvas) {
      updateLayer(activeLayerId, { dataUrl: layerCanvas.toDataURL() });
      recordHistory('Layer Styles Applied');
    }
    setIsLayerStyleDialogOpen(false);
  };

  const handleCancel = () => {
    // Restore backup canvas original pixels
    const layerCanvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
    if (layerCanvas && backupCanvas) {
      const ctx = layerCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
        ctx.drawImage(backupCanvas, 0, 0);
      }
    }
    // Restore original opacity/blendMode to the store
    if (backupCanvas) {
      updateLayer(activeLayerId, {
        opacity: (activeLayer.opacity ?? 1),
        blendMode: activeLayer.blendMode
      });
    }
    setIsLayerStyleDialogOpen(false);
  };

  return (
    <div className="dialog-overlay filter-gallery-overlay" onClick={handleCancel}>
      <motion.div
        drag={!isMobile}
        dragControls={isMobile ? undefined : dragControls}
        dragListener={false}
        dragMomentum={false}
        dragElastic={0}
        className="dialog-content filter-gallery-dialog"
        onClick={(e) => e.stopPropagation()}
        style={isMobile ? {} : { width: '640px' }}
      >
        <div 
          className="dialog-header drag-handle" 
          onPointerDown={(e) => !isMobile && dragControls.start(e)}
          style={{ cursor: isMobile ? 'default' : 'grab' }}
        >
          <h3>Layer Style</h3>
          <button className="dialog-close" onClick={handleCancel}>
            <LucideIcons.X size={18} />
          </button>
        </div>

        <div className="dialog-body" style={{ display: 'flex', minHeight: '320px', padding: 0 }}>
          {/* Sidebar Tabs */}
          <div
            style={{
              width: '180px',
              borderRight: '1px solid var(--border-color, #333)',
              backgroundColor: 'rgba(0,0,0,0.1)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <button
              onClick={() => setLayerStyleActiveTab('blending')}
              style={{
                padding: '12px 16px',
                textAlign: 'left',
                border: 'none',
                background: layerStyleActiveTab === 'blending' ? 'var(--input-bg, #333)' : 'transparent',
                color: layerStyleActiveTab === 'blending' ? '#0088ff' : '#ccc',
                fontWeight: layerStyleActiveTab === 'blending' ? 'bold' : 'normal',
                cursor: 'pointer',
                borderLeft: layerStyleActiveTab === 'blending' ? '4px solid #0088ff' : '4px solid transparent',
              }}
            >
              Blending Options
            </button>

            <button
              onClick={() => setLayerStyleActiveTab('shadow')}
              style={{
                padding: '12px 16px',
                textAlign: 'left',
                border: 'none',
                background: layerStyleActiveTab === 'shadow' ? 'var(--input-bg, #333)' : 'transparent',
                color: layerStyleActiveTab === 'shadow' ? '#0088ff' : '#ccc',
                fontWeight: layerStyleActiveTab === 'shadow' ? 'bold' : 'normal',
                cursor: 'pointer',
                borderLeft: layerStyleActiveTab === 'shadow' ? '4px solid #0088ff' : '4px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <input
                type="checkbox"
                checked={shadowEnabled}
                onChange={(e) => setShadowEnabled(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
              />
              Drop Shadow
            </button>

            <button
              onClick={() => setLayerStyleActiveTab('stroke')}
              style={{
                padding: '12px 16px',
                textAlign: 'left',
                border: 'none',
                background: layerStyleActiveTab === 'stroke' ? 'var(--input-bg, #333)' : 'transparent',
                color: layerStyleActiveTab === 'stroke' ? '#0088ff' : '#ccc',
                fontWeight: layerStyleActiveTab === 'stroke' ? 'bold' : 'normal',
                cursor: 'pointer',
                borderLeft: layerStyleActiveTab === 'stroke' ? '4px solid #0088ff' : '4px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <input
                type="checkbox"
                checked={strokeEnabled}
                onChange={(e) => setStrokeEnabled(e.target.checked)}
                onClick={(e) => e.stopPropagation()}
              />
              Stroke
            </button>
          </div>

          {/* Active Tab Panel Content */}
          <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {layerStyleActiveTab === 'blending' && (
              <>
                <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #333', paddingBottom: '6px' }}>General Blending</h4>
                
                <div className="dialog-control-group">
                  <label>Opacity: {opacity}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={opacity}
                    onChange={(e) => setOpacity(parseInt(e.target.value))}
                  />
                </div>

                <div className="dialog-control-group">
                  <label>Blend Mode</label>
                  <select
                    value={blendMode}
                    onChange={(e) => setBlendMode(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      backgroundColor: 'var(--input-bg, #2b2b2b)',
                      color: 'var(--input-color, #ffffff)',
                      border: '1px solid var(--border-color, #3f3f3f)',
                      borderRadius: '4px',
                    }}
                  >
                    <option value="source-over">Normal</option>
                    <option value="multiply">Multiply</option>
                    <option value="screen">Screen</option>
                    <option value="overlay">Overlay</option>
                    <option value="darken">Darken</option>
                    <option value="lighten">Lighten</option>
                    <option value="color-dodge">Color Dodge</option>
                    <option value="color-burn">Color Burn</option>
                    <option value="hard-light">Hard Light</option>
                    <option value="soft-light">Soft Light</option>
                    <option value="difference">Difference</option>
                    <option value="exclusion">Exclusion</option>
                  </select>
                </div>
              </>
            )}

            {layerStyleActiveTab === 'shadow' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '6px', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0 }}>Drop Shadow Settings</h4>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    <input
                      type="checkbox"
                      checked={shadowEnabled}
                      onChange={(e) => setShadowEnabled(e.target.checked)}
                    />
                    Enable Shadow
                  </label>
                </div>

                <div style={{ opacity: shadowEnabled ? 1 : 0.4, pointerEvents: shadowEnabled ? 'auto' : 'none', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ display: 'flex', gap: '20px' }}>
                    <div className="dialog-control-group" style={{ flex: 1 }}>
                      <label>Color</label>
                      <input
                        type="color"
                        value={shadowColor}
                        onChange={(e) => setShadowColor(e.target.value)}
                        style={{ width: '100%', height: '36px', padding: '2px', border: '1px solid #333', borderRadius: '4px', cursor: 'pointer' }}
                      />
                    </div>
                    <div className="dialog-control-group" style={{ flex: 2 }}>
                      <label>Opacity: {shadowOpacity}%</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={shadowOpacity}
                        onChange={(e) => setShadowOpacity(parseInt(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="dialog-control-group">
                    <label>Angle: {shadowAngle}°</label>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={shadowAngle}
                      onChange={(e) => setShadowAngle(parseInt(e.target.value))}
                    />
                  </div>

                  <div className="dialog-control-group">
                    <label>Distance: {shadowDistance}px</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={shadowDistance}
                      onChange={(e) => setShadowDistance(parseInt(e.target.value))}
                    />
                  </div>

                  <div className="dialog-control-group">
                    <label>Size / Blur: {shadowSize}px</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={shadowSize}
                      onChange={(e) => setShadowSize(parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </>
            )}

            {layerStyleActiveTab === 'stroke' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '6px', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0 }}>Stroke Settings</h4>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    <input
                      type="checkbox"
                      checked={strokeEnabled}
                      onChange={(e) => setStrokeEnabled(e.target.checked)}
                    />
                    Enable Stroke
                  </label>
                </div>

                <div style={{ opacity: strokeEnabled ? 1 : 0.4, pointerEvents: strokeEnabled ? 'auto' : 'none', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div className="dialog-control-group">
                    <label>Size: {strokeSize}px</label>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={strokeSize}
                      onChange={(e) => setStrokeSize(parseInt(e.target.value))}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '20px' }}>
                    <div className="dialog-control-group" style={{ flex: 1 }}>
                      <label>Color</label>
                      <input
                        type="color"
                        value={strokeColor}
                        onChange={(e) => setStrokeColor(e.target.value)}
                        style={{ width: '100%', height: '36px', padding: '2px', border: '1px solid #333', borderRadius: '4px', cursor: 'pointer' }}
                      />
                    </div>
                    <div className="dialog-control-group" style={{ flex: 2 }}>
                      <label>Opacity: {strokeOpacity}%</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={strokeOpacity}
                        onChange={(e) => setStrokeOpacity(parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="dialog-footer" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color, #333)' }}>
          <button className="btn btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleApply}>
            OK
          </button>
        </div>
      </motion.div>
    </div>
  );
};
