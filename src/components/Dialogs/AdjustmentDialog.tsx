import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { loadImage, applyPixiAdjustments } from '../../utils/pixiUtils';
import * as LucideIcons from 'lucide-react';
import { motion, useDragControls } from 'framer-motion';
import './Dialogs.css';

export const AdjustmentDialog: React.FC = () => {
  const dragControls = useDragControls();
  const activeAdjustmentModal = useStore((state) => state.activeAdjustmentModal);
  const setActiveAdjustmentModal = useStore((state) => state.setActiveAdjustmentModal);
  const activeLayerId = useStore((state) => state.activeLayerId);
  const layers = useStore((state) => state.layers);
  const updateLayer = useStore((state) => state.updateLayer);
  const recordHistory = useStore((state) => state.recordHistory);

  const activeLayer = layers.find((l) => l.id === activeLayerId);

  // Store the original layer state
  const originalDataUrlRef = useRef<string | null>(null);
  const activeLayerIdRef = useRef<string | null>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Slider / selection states
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [lightness, setLightness] = useState(0);
  const [effect, setEffect] = useState<'sepia' | 'vintage' | 'polaroid' | 'technicolor' | 'lsd' | 'kodachrome' | 'brownie' | 'night' | 'negative' | 'predator' | 'none'>('none');

  // Load the layer's image once when modal opens
  useEffect(() => {
    if (activeAdjustmentModal) {
      const state = useStore.getState();
      const currentLayer = state.layers.find((l: any) => l.id === state.activeLayerId);
      if (!currentLayer) return;

      let dataUrl = currentLayer.dataUrl;

      // If it's a paint layer and doesn't have a dataUrl, initialize it
      if (!dataUrl && currentLayer.type === 'paint') {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = currentLayer.width || state.documentSize.w;
        tempCanvas.height = currentLayer.height || state.documentSize.h;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          if (currentLayer.name === 'Background') {
            tempCtx.fillStyle = '#ffffff';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          } else {
            tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
          }
          dataUrl = tempCanvas.toDataURL();
          updateLayer(currentLayer.id, { dataUrl });
        }
      }

      if (dataUrl) {
        originalDataUrlRef.current = dataUrl;
        activeLayerIdRef.current = currentLayer.id;
        setIsLoaded(false);

        // Reset values
        setBrightness(0);
        setContrast(0);
        setHue(0);
        setSaturation(0);
        setLightness(0);
        setEffect('none');

        loadImage(dataUrl)
          .then((img) => {
            originalImageRef.current = img;
            setIsLoaded(true);
            // For Black & White, apply immediately on load
            if (activeAdjustmentModal === 'black_white') {
              applyPreview({ greyscale: true });
            }
          })
          .catch((err) => {
            console.error('Failed to pre-load image:', err);
          });
      }
    }

    return () => {
      originalImageRef.current = null;
    };
  }, [activeAdjustmentModal]);

  // Handle keyboard listener for Escape/Enter keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeAdjustmentModal) return;
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter') {
        handleOK();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeAdjustmentModal, brightness, contrast, hue, saturation, lightness, effect]);

  if (!activeAdjustmentModal) return null;

  const handleCancel = () => {
    if (originalDataUrlRef.current && activeLayerIdRef.current) {
      updateLayer(activeLayerIdRef.current, { dataUrl: originalDataUrlRef.current });
    }
    setActiveAdjustmentModal(null);
  };

  const handleOK = () => {
    let actionName = 'Adjustment';
    if (activeAdjustmentModal === 'brightness_contrast') actionName = 'Brightness/Contrast';
    else if (activeAdjustmentModal === 'hue_saturation') actionName = 'Hue/Saturation';
    else if (activeAdjustmentModal === 'black_white') actionName = 'Black & White';
    else if (activeAdjustmentModal === 'photo_effects') actionName = `Photo Effect: ${effect}`;

    recordHistory(actionName);
    setActiveAdjustmentModal(null);
  };

  const applyPreview = async (currentSettings: {
    brightness?: number;
    contrast?: number;
    hue?: number;
    saturation?: number;
    lightness?: number;
    greyscale?: boolean;
    effect?: any;
  }) => {
    const originalImage = originalImageRef.current;
    const layerId = activeLayerIdRef.current;
    if (!originalImage || !layerId) return;

    try {
      const resultDataUrl = await applyPixiAdjustments(originalImage, currentSettings);
      updateLayer(layerId, { dataUrl: resultDataUrl });
    } catch (err) {
      console.error('Failed to apply adjustment preview:', err);
    }
  };

  const handleBrightnessChange = (val: number) => {
    setBrightness(val);
    applyPreview({ brightness: val, contrast });
  };

  const handleContrastChange = (val: number) => {
    setContrast(val);
    applyPreview({ brightness, contrast: val });
  };

  const handleHueChange = (val: number) => {
    setHue(val);
    applyPreview({ hue: val, saturation, lightness });
  };

  const handleSaturationChange = (val: number) => {
    setSaturation(val);
    applyPreview({ hue, saturation: val, lightness });
  };

  const handleLightnessChange = (val: number) => {
    setLightness(val);
    applyPreview({ hue, saturation, lightness: val });
  };

  const handleEffectChange = (eff: typeof effect) => {
    setEffect(eff);
    applyPreview({ effect: eff });
  };

  if (!activeLayer || !activeLayer.dataUrl) {
    return (
      <div className="dialog-overlay" onClick={handleCancel}>
        <div className="dialog-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '30rem' }}>
          <div className="dialog-header">
            <h2>Adjustment Error</h2>
            <button className="dialog-close" onClick={handleCancel}>
              <LucideIcons.X size={16} />
            </button>
          </div>
          <div className="dialog-body" style={{ textAlign: 'center', padding: '2rem 1.25rem' }}>
            <LucideIcons.AlertTriangle size={48} style={{ color: '#ffcc00', marginBottom: '1rem' }} />
            <p>Please select an editable image or paint layer to apply WebGL adjustments.</p>
          </div>
          <div className="dialog-footer">
            <button className="btn-primary" onClick={handleCancel}>OK</button>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (!isLoaded) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div className="loading-spinner" style={{ width: '2rem', height: '2rem', border: '3px solid #555', borderTopColor: '#0066cc', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '1rem' }} />
          <span>Loading WebGL context...</span>
        </div>
      );
    }

    switch (activeAdjustmentModal) {
      case 'brightness_contrast':
        return (
          <div className="adjustment-sliders-container">
            <div className="adjustment-control-row">
              <div className="control-header">
                <label>Brightness:</label>
                <input
                  type="number"
                  min="-100"
                  max="100"
                  value={brightness}
                  onChange={(e) => handleBrightnessChange(Math.max(-100, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                  className="control-number-input"
                />
              </div>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={brightness}
                  onChange={(e) => handleBrightnessChange(parseInt(e.target.value, 10))}
                  className="adjustment-range"
                />
              </div>
            </div>

            <div className="adjustment-control-row" style={{ marginTop: '1.5rem' }}>
              <div className="control-header">
                <label>Contrast:</label>
                <input
                  type="number"
                  min="-100"
                  max="100"
                  value={contrast}
                  onChange={(e) => handleContrastChange(Math.max(-100, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                  className="control-number-input"
                />
              </div>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={contrast}
                  onChange={(e) => handleContrastChange(parseInt(e.target.value, 10))}
                  className="adjustment-range"
                />
              </div>
            </div>
          </div>
        );

      case 'hue_saturation':
        return (
          <div className="adjustment-sliders-container">
            <div className="adjustment-control-row">
              <div className="control-header">
                <label>Hue:</label>
                <input
                  type="number"
                  min="-180"
                  max="180"
                  value={hue}
                  onChange={(e) => handleHueChange(Math.max(-180, Math.min(180, parseInt(e.target.value, 10) || 0)))}
                  className="control-number-input"
                />
              </div>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={hue}
                  onChange={(e) => handleHueChange(parseInt(e.target.value, 10))}
                  className="adjustment-range hue-range-slider"
                />
              </div>
            </div>

            <div className="adjustment-control-row" style={{ marginTop: '1.5rem' }}>
              <div className="control-header">
                <label>Saturation:</label>
                <input
                  type="number"
                  min="-100"
                  max="100"
                  value={saturation}
                  onChange={(e) => handleSaturationChange(Math.max(-100, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                  className="control-number-input"
                />
              </div>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={saturation}
                  onChange={(e) => handleSaturationChange(parseInt(e.target.value, 10))}
                  className="adjustment-range"
                />
              </div>
            </div>

            <div className="adjustment-control-row" style={{ marginTop: '1.5rem' }}>
              <div className="control-header">
                <label>Lightness:</label>
                <input
                  type="number"
                  min="-100"
                  max="100"
                  value={lightness}
                  onChange={(e) => handleLightnessChange(Math.max(-100, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                  className="control-number-input"
                />
              </div>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={lightness}
                  onChange={(e) => handleLightnessChange(parseInt(e.target.value, 10))}
                  className="adjustment-range"
                />
              </div>
            </div>
          </div>
        );

      case 'black_white':
        return (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <LucideIcons.Eye size={40} style={{ color: '#0066cc', marginBottom: '0.75rem' }} />
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#ccc' }}>
              The selected layer has been converted to Black & White using a WebGL-optimized color matrix filter.
            </p>
          </div>
        );

      case 'photo_effects':
        const presets: { name: string; value: typeof effect; desc: string }[] = [
          { name: 'None', value: 'none', desc: 'No filter' },
          { name: 'Sepia', value: 'sepia', desc: 'Warm sepia' },
          { name: 'Vintage', value: 'vintage', desc: 'Retro colors' },
          { name: 'Polaroid', value: 'polaroid', desc: 'Faded Polaroid' },
          { name: 'Technicolor', value: 'technicolor', desc: 'Bright cinema' },
          { name: 'LSD', value: 'lsd', desc: 'Trippy shift' },
          { name: 'Kodachrome', value: 'kodachrome', desc: 'Classic film' },
          { name: 'Brownie', value: 'brownie', desc: 'Old photo' },
          { name: 'Night', value: 'night', desc: 'Night vision' },
          { name: 'Negative', value: 'negative', desc: 'Inverted' },
          { name: 'Predator', value: 'predator', desc: 'Thermal' }
        ];

        return (
          <div className="effects-panel-container">
            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: '0.75rem' }}>Select Photo Effect</label>
            <div className="effects-grid">
              {presets.map((preset) => (
                <button
                  key={preset.value}
                  className={`effect-card-btn ${effect === preset.value ? 'active' : ''}`}
                  onClick={() => handleEffectChange(preset.value)}
                >
                  <span className="effect-card-title">{preset.name}</span>
                  <span className="effect-card-desc">{preset.desc}</span>
                </button>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getModalTitle = () => {
    switch (activeAdjustmentModal) {
      case 'brightness_contrast':
        return 'Brightness / Contrast';
      case 'hue_saturation':
        return 'Hue / Saturation';
      case 'black_white':
        return 'Black & White';
      case 'photo_effects':
        return 'Photo Effects';
      default:
        return 'Adjustments';
    }
  };

  return (
    <div className="dialog-overlay adjustment-overlay">
      <motion.div
        drag
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragElastic={0}
        className="dialog-content adjustment-dialog-content"
        style={{ maxWidth: '34rem' }}
      >
        <div
          className="dialog-header draggable-header"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <h2>{getModalTitle()}</h2>
          <button className="dialog-close" onClick={handleCancel}>
            <LucideIcons.X size={16} />
          </button>
        </div>
        <div className="dialog-body">
          {renderContent()}
        </div>
        <div className="dialog-footer">
          <button className="btn-secondary" onClick={handleCancel}>Cancel</button>
          <button className="btn-primary" onClick={handleOK} disabled={!isLoaded}>OK</button>
        </div>
      </motion.div>

      {/* Keyframe animation for spinner */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
