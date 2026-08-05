import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import { findLayerById } from '../../utils/layerUtils';
import { ContentAwareScaleService } from '../../services/image/ContentAwareScaleService';
import './Dialogs.css';

export const ContentAwareScaleDialog: React.FC = () => {
  const {
    isContentAwareScaleDialogOpen,
    setIsContentAwareScaleDialogOpen,
    layers,
    activeLayerId,
    updateLayer,
    recordHistory,
    addAlert,
  } = useStore();

  const [widthInput, setWidthInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [isScaling, setIsScaling] = useState(false);

  // Initialize inputs when dialog opens
  useEffect(() => {
    if (isContentAwareScaleDialogOpen && activeLayerId) {
      const canvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
      if (canvas) {
        setWidthInput(canvas.width.toString());
        setHeightInput(canvas.height.toString());
      } else {
        const activeLayer = activeLayerId ? findLayerById(layers, activeLayerId) : undefined;
        if (activeLayer) {
          setWidthInput((activeLayer.width || 800).toString());
          setHeightInput((activeLayer.height || 600).toString());
        }
      }
    }
  }, [isContentAwareScaleDialogOpen, activeLayerId, layers]);

  if (!isContentAwareScaleDialogOpen) return null;

  const handleScale = () => {
    const targetW = parseInt(widthInput) || 0;
    const targetH = parseInt(heightInput) || 0;

    if (targetW <= 0 || targetH <= 0) {
      addAlert({ type: 'error', message: 'Please enter valid width and height dimensions.' });
      return;
    }

    setIsScaling(true);

    // Yield control so the spinner updates
    setTimeout(() => {
      try {
        const canvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
        const ctx = canvas?.getContext('2d');
        if (!ctx) {
          addAlert({ type: 'error', message: 'Active layer canvas not found.' });
          return;
        }

        const srcData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const resultData = ContentAwareScaleService.scale(srcData, targetW, targetH);

        // Update the active layer canvas size and draw the result
        canvas.width = targetW;
        canvas.height = targetH;
        const newCtx = canvas.getContext('2d')!;
        newCtx.putImageData(resultData, 0, 0);

        // Update store state
        updateLayer(activeLayerId, {
          width: targetW,
          height: targetH,
          dataUrl: canvas.toDataURL(),
        });

        recordHistory('Content-Aware Scale');
        addAlert({ type: 'success', message: 'Content-Aware Scale applied.' });
        setIsContentAwareScaleDialogOpen(false);
      } catch (err: any) {
        console.error('[Content-Aware Scale] Error:', err);
        addAlert({ type: 'error', message: 'Scale failed: ' + err.message });
      } finally {
        setIsScaling(false);
      }
    }, 50);
  };

  return (
    <div className="dialog-overlay" onClick={() => !isScaling && setIsContentAwareScaleDialogOpen(false)}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()} style={{ width: '380px' }}>
        <div className="dialog-header">
          <h3>Content-Aware Scale</h3>
          <button className="dialog-close" onClick={() => !isScaling && setIsContentAwareScaleDialogOpen(false)}>
            <LucideIcons.X size={18} />
          </button>
        </div>

        <div className="dialog-body" style={{ padding: '16px 20px' }}>
          {isScaling ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
              <LucideIcons.Loader2 size={32} className="animate-spin" style={{ color: '#4a9eff' }} />
              <span style={{ fontSize: '13px', color: '#ddd' }}>Analyzing and removing low-energy seams...</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#ddd' }}>Width:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    value={widthInput}
                    onChange={(e) => setWidthInput(e.target.value)}
                    style={{
                      width: '80px', background: '#1a1a1a', color: '#fff', border: '1px solid #444',
                      borderRadius: '4px', padding: '4px 8px', fontSize: '12px', outline: 'none', textAlign: 'right',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: '#888' }}>Pixels</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#ddd' }}>Height:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    value={heightInput}
                    onChange={(e) => setHeightInput(e.target.value)}
                    style={{
                      width: '80px', background: '#1a1a1a', color: '#fff', border: '1px solid #444',
                      borderRadius: '4px', padding: '4px 8px', fontSize: '12px', outline: 'none', textAlign: 'right',
                    }}
                  />
                  <span style={{ fontSize: '11px', color: '#888' }}>Pixels</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="dialog-footer" style={{ borderTop: '1px solid #333', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button className="btn-secondary" onClick={() => setIsContentAwareScaleDialogOpen(false)} disabled={isScaling}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleScale} disabled={isScaling} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isScaling && <LucideIcons.Loader2 size={14} className="animate-spin" />}
            Scale
          </button>
        </div>
      </div>
    </div>
  );
};
