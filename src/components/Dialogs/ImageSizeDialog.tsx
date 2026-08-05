import React, { useState, useEffect, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { motion, useDragControls } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { ImageResizeService } from '../../services/image/ImageResizeService';
import './Dialogs.css';

// DPI conversion helper
const convertInchesToUnit = (inches: number, unit: string, dpi: number): number => {
  switch (unit) {
    case 'px':
      return Math.round(inches * dpi);
    case 'in':
      return Math.round(inches * 100) / 100;
    case 'cm':
      return Math.round(inches * 2.54 * 100) / 100;
    case 'mm':
      return Math.round(inches * 25.4 * 10) / 10;
    default:
      return Math.round(inches * dpi);
  }
};

const convertUnitToInches = (value: number, unit: string, dpi: number): number => {
  switch (unit) {
    case 'px':
      return value / dpi;
    case 'in':
      return value;
    case 'cm':
      return value / 2.54;
    case 'mm':
      return value / 25.4;
    default:
      return value / dpi;
  }
};

export const ImageSizeDialog: React.FC = () => {
  const dragControls = useDragControls();
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const {
    isImageSizeDialogOpen,
    setIsImageSizeDialogOpen,
    documentSize,
    setDocumentSize,
    layers,
    setLayers,
    recordHistory,
    addAlert,
    resolution = 72,
    setResolution
  } = useStore();

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Form states
  const [resample, setResample] = useState(true);
  const [maintainAspect, setMaintainAspect] = useState(true);
  const [resamplingMethod, setResamplingMethod] = useState<'nearest' | 'bilinear' | 'bicubic' | 'lanczos' | 'high-quality'>('bicubic');

  const [widthUnit, setWidthUnit] = useState<'px' | 'percent' | 'in' | 'cm' | 'mm'>('px');
  const [heightUnit, setHeightUnit] = useState<'px' | 'percent' | 'in' | 'cm' | 'mm'>('px');

  const [widthInput, setWidthInput] = useState('0');
  const [heightInput, setHeightInput] = useState('0');
  const [resolutionInput, setResolutionInput] = useState('72');
  const [showPreview, setShowPreview] = useState(true);

  // Original sizes
  const [originalW, setOriginalW] = useState(0);
  const [originalH, setOriginalH] = useState(0);
  const [originalRes, setOriginalRes] = useState(72);
  const [originalAspect, setOriginalAspect] = useState(1);

  // Initialize values when dialog opens
  useEffect(() => {
    if (isImageSizeDialogOpen) {
      const w = documentSize.w;
      const h = documentSize.h;
      const res = resolution || 72;

      setOriginalW(w);
      setOriginalH(h);
      setOriginalRes(res);
      setOriginalAspect(w / h);

      setWidthUnit('px');
      setHeightUnit('px');
      setWidthInput(w.toString());
      setHeightInput(h.toString());
      setResolutionInput(res.toString());
      setResample(true);
      setMaintainAspect(true);
      setResamplingMethod('bicubic');
      setShowPreview(true);
    }
  }, [isImageSizeDialogOpen, documentSize, resolution]);

  // Compute final pixel dimensions and scale factors
  const getFinalDimensions = () => {
    const res = parseFloat(resolutionInput) || 72;
    let targetW = originalW;
    let targetH = originalH;

    const rawW = parseFloat(widthInput) || 0;
    const rawH = parseFloat(heightInput) || 0;

    if (!resample) {
      // Pixel dimensions must remain identical to original.
      targetW = originalW;
      targetH = originalH;
    } else {
      // Width conversion
      if (widthUnit === 'px') {
        targetW = Math.max(1, Math.round(rawW));
      } else if (widthUnit === 'percent') {
        targetW = Math.max(1, Math.round((rawW / 100) * originalW));
      } else {
        const inches = convertUnitToInches(rawW, widthUnit, res);
        targetW = Math.max(1, Math.round(inches * res));
      }

      // Height conversion
      if (heightUnit === 'px') {
        targetH = Math.max(1, Math.round(rawH));
      } else if (heightUnit === 'percent') {
        targetH = Math.max(1, Math.round((rawH / 100) * originalH));
      } else {
        const inches = convertUnitToInches(rawH, heightUnit, res);
        targetH = Math.max(1, Math.round(inches * res));
      }
    }

    return { targetW, targetH, finalResolution: res };
  };

  const { targetW, targetH, finalResolution } = getFinalDimensions();
  const scalePercentX = Math.round((targetW / originalW) * 100 * 10) / 10;
  const scalePercentY = Math.round((targetH / originalH) * 100 * 10) / 10;
  const originalMem = ((originalW * originalH * 4) / (1024 * 1024)).toFixed(2);
  const newMem = ((targetW * targetH * 4) / (1024 * 1024)).toFixed(2);

  // Sync inputs based on Photoshop-like constraints
  const handleWidthChange = (val: string) => {
    setWidthInput(val);
    const parsed = parseFloat(val) || 0;
    const res = parseFloat(resolutionInput) || 72;

    if (resample) {
      if (maintainAspect && originalAspect > 0) {
        // Calculate target height in pixels, then convert to selected unit
        let pxW = 0;
        if (widthUnit === 'px') pxW = parsed;
        else if (widthUnit === 'percent') pxW = (parsed / 100) * originalW;
        else pxW = convertUnitToInches(parsed, widthUnit, res) * res;

        const pxH = pxW / originalAspect;

        let convertedH = pxH;
        if (heightUnit === 'px') convertedH = pxH;
        else if (heightUnit === 'percent') convertedH = (pxH / originalH) * 100;
        else convertedH = convertInchesToUnit(pxH / res, heightUnit, res);

        setHeightInput(parseFloat(convertedH.toFixed(2)).toString());
      }
    } else {
      // Resampling is OFF: pixel sizes are locked. Physical size change updates resolution.
      if (parsed > 0) {
        let inches = convertUnitToInches(parsed, widthUnit, res);
        if (inches > 0) {
          const newRes = originalW / inches;
          setResolutionInput(Math.round(newRes).toString());

          // Update height physical size based on new resolution
          const inchesH = originalH / newRes;
          const convertedH = convertInchesToUnit(inchesH, heightUnit, newRes);
          setHeightInput(parseFloat(convertedH.toFixed(2)).toString());
        }
      }
    }
  };

  const handleHeightChange = (val: string) => {
    setHeightInput(val);
    const parsed = parseFloat(val) || 0;
    const res = parseFloat(resolutionInput) || 72;

    if (resample) {
      if (maintainAspect && originalAspect > 0) {
        let pxH = 0;
        if (heightUnit === 'px') pxH = parsed;
        else if (heightUnit === 'percent') pxH = (parsed / 100) * originalH;
        else pxH = convertUnitToInches(parsed, heightUnit, res) * res;

        const pxW = pxH * originalAspect;

        let convertedW = pxW;
        if (widthUnit === 'px') convertedW = pxW;
        else if (widthUnit === 'percent') convertedW = (pxW / originalW) * 100;
        else convertedW = convertInchesToUnit(pxW / res, widthUnit, res);

        setWidthInput(parseFloat(convertedW.toFixed(2)).toString());
      }
    } else {
      // Resampling is OFF: pixel sizes are locked. Physical size change updates resolution.
      if (parsed > 0) {
        let inches = convertUnitToInches(parsed, heightUnit, res);
        if (inches > 0) {
          const newRes = originalH / inches;
          setResolutionInput(Math.round(newRes).toString());

          // Update width physical size based on new resolution
          const inchesW = originalW / newRes;
          const convertedW = convertInchesToUnit(inchesW, widthUnit, newRes);
          setWidthInput(parseFloat(convertedW.toFixed(2)).toString());
        }
      }
    }
  };

  const handleResolutionChange = (val: string) => {
    setResolutionInput(val);
    const res = parseFloat(val) || 72;
    if (res <= 0) return;

    if (resample) {
      // Resampling ON: Keep physical dimensions constant, scale pixel dimensions.
      // Width input in physical unit conversion
      if (widthUnit !== 'px' && widthUnit !== 'percent') {
        const inchesW = convertUnitToInches(parseFloat(widthInput) || 0, widthUnit, originalRes);
        const pxW = Math.round(inchesW * res);
        setWidthInput(pxW.toString()); // Convert or reset width unit to match? Actually lock physical size, recalculate input.
      } else {
        // If px, update pixel size directly based on ratio change
        const ratio = res / originalRes;
        const pxW = Math.round(originalW * ratio);
        setWidthInput(pxW.toString());
      }

      if (heightUnit !== 'px' && heightUnit !== 'percent') {
        const inchesH = convertUnitToInches(parseFloat(heightInput) || 0, heightUnit, originalRes);
        const pxH = Math.round(inchesH * res);
        setHeightInput(pxH.toString());
      } else {
        const ratio = res / originalRes;
        const pxH = Math.round(originalH * ratio);
        setHeightInput(pxH.toString());
      }
    } else {
      // Resampling OFF: Pixels are locked, change in resolution changes physical width/height.
      const inchesW = originalW / res;
      const convertedW = convertInchesToUnit(inchesW, widthUnit, res);
      setWidthInput(parseFloat(convertedW.toFixed(2)).toString());

      const inchesH = originalH / res;
      const convertedH = convertInchesToUnit(inchesH, heightUnit, res);
      setHeightInput(parseFloat(convertedH.toFixed(2)).toString());
    }
  };

  const handleResampleToggle = (checked: boolean) => {
    setResample(checked);
    if (!checked) {
      // Locking pixels: reset inputs to display physical size corresponding to resolution
      const res = parseFloat(resolutionInput) || 72;
      const inchesW = originalW / res;
      const convertedW = convertInchesToUnit(inchesW, widthUnit, res);
      setWidthInput(parseFloat(convertedW.toFixed(2)).toString());

      const inchesH = originalH / res;
      const convertedH = convertInchesToUnit(inchesH, heightUnit, res);
      setHeightInput(parseFloat(convertedH.toFixed(2)).toString());
    }
  };

  // Draw Real-time Resampling Preview (renders a small zoomed region to show resampling quality)
  useEffect(() => {
    if (!isImageSizeDialogOpen || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get active layer image or first layer
    const activeLayer = layers.find(l => l.id === useStore.getState().activeLayerId) || layers[0];
    if (!activeLayer || !activeLayer.dataUrl) {
      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#666';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No Image Layer Data', canvas.width / 2, canvas.height / 2);
      return;
    }

    if (!showPreview) {
      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#666';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Preview Disabled', canvas.width / 2, canvas.height / 2);
      return;
    }

    const img = new Image();
    img.onload = () => {
      // We will grab a 40x40 square around the center of the image, and scale it to fit the 180x180 preview canvas.
      const srcW = img.width;
      const srcH = img.height;
      const cropW = Math.min(40, srcW);
      const cropH = Math.min(40, srcH);
      const cropX = Math.round((srcW - cropW) / 2);
      const cropY = Math.round((srcH - cropH) / 2);

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const cropCtx = cropCanvas.getContext('2d');
      if (!cropCtx) return;
      cropCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      const srcData = cropCtx.getImageData(0, 0, cropW, cropH);
      const dstW = canvas.width;
      const dstH = canvas.height;

      let resampledData: ImageData;
      // Resample the cropped portion to show pixel interpolation quality
      if (resamplingMethod === 'nearest') {
        resampledData = ImageResizeService.resampleNearest(srcData, dstW, dstH);
      } else if (resamplingMethod === 'bilinear') {
        resampledData = ImageResizeService.resampleBilinear(srcData, dstW, dstH);
      } else if (resamplingMethod === 'bicubic') {
        resampledData = ImageResizeService.resampleBicubic(srcData, dstW, dstH);
      } else if (resamplingMethod === 'lanczos') {
        resampledData = ImageResizeService.resampleLanczos(srcData, dstW, dstH);
      } else {
        // High quality fallback
        const hqCanvas = document.createElement('canvas');
        hqCanvas.width = dstW;
        hqCanvas.height = dstH;
        const hqCtx = hqCanvas.getContext('2d');
        if (hqCtx) {
          hqCtx.imageSmoothingEnabled = true;
          hqCtx.imageSmoothingQuality = 'high';
          hqCtx.drawImage(cropCanvas, 0, 0, cropW, cropH, 0, 0, dstW, dstH);
          resampledData = hqCtx.getImageData(0, 0, dstW, dstH);
        } else {
          resampledData = ImageResizeService.resampleBicubic(srcData, dstW, dstH);
        }
      }

      ctx.putImageData(resampledData, 0, 0);

      // Label showing resampler name
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(4, 4, 100, 18);
      ctx.fillStyle = '#fff';
      ctx.font = '9px sans-serif';
      ctx.fillText(resamplingMethod.toUpperCase() + ' (Zoomed)', 8, 16);
    };
    img.src = activeLayer.dataUrl!;
  }, [isImageSizeDialogOpen, layers, resamplingMethod, showPreview]);

  const handleOK = async () => {
    // Save Resolution regardless
    if (setResolution) {
      setResolution(finalResolution);
    }

    if (!resample) {
      // No resampling: pixel sizes locked. Just update history/resolution
      recordHistory('Image Size');
      setIsImageSizeDialogOpen(false);
      return;
    }

    // Proportional scale factor
    const scaleX = targetW / originalW;
    const scaleY = targetH / originalH;

    // Apply resampling on every layer
    const updatedLayers = await Promise.all(
      layers.map(async (layer) => {
        const newW = Math.max(1, Math.round((layer.width || originalW) * scaleX));
        const newH = Math.max(1, Math.round((layer.height || originalH) * scaleY));
        const newX = Math.round(layer.position.x * scaleX);
        const newY = Math.round(layer.position.y * scaleY);

        if (layer.dataUrl) {
          // Pixel scaling via service
          const resampledUrl = await ImageResizeService.resampleImage(
            layer.dataUrl,
            newW,
            newH,
            resamplingMethod
          );

          return {
            ...layer,
            position: { x: newX, y: newY },
            width: newW,
            height: newH,
            dataUrl: resampledUrl
          };
        }

        // Vector or group layer scaling
        return {
          ...layer,
          position: { x: newX, y: newY },
          width: newW,
          height: newH
        };
      })
    );

    setLayers(updatedLayers);
    setDocumentSize({ w: targetW, h: targetH });
    recordHistory('Image Size');

    if (addAlert) {
      addAlert({
        type: 'success',
        message: `Image dimensions scaled to ${targetW} x ${targetH} px.`
      });
    }

    setIsImageSizeDialogOpen(false);
  };

  if (!isImageSizeDialogOpen) return null;

  return (
    <div className="dialog-overlay" onClick={() => setIsImageSizeDialogOpen(false)}>
      <motion.div
        drag={!isMobile}
        dragControls={isMobile ? undefined : dragControls}
        dragListener={false}
        dragMomentum={false}
        dragElastic={0}
        className="dialog-content image-size-dialog"
        onClick={e => e.stopPropagation()}
        style={isMobile ? {} : { maxWidth: '44rem' }}
      >
        <div 
          className="dialog-header drag-handle" 
          onPointerDown={(e) => !isMobile && dragControls.start(e)}
          style={{ cursor: isMobile ? 'default' : 'grab' }}
        >
          <h2>Image Size</h2>
          <button className="dialog-close" onClick={() => setIsImageSizeDialogOpen(false)}>
            <LucideIcons.X size={20} />
          </button>
        </div>

        <div className="dialog-body canvas-size-body-split">
          
          {/* Form parameters controls */}
          <div className="canvas-size-controls">
            
            {/* Memory Info size summary */}
            <div className="canvas-size-section current-size-info">
              <span className="section-title">Image Size Summary:</span>
              <div className="size-row">
                <span className="size-label">Original:</span>
                <span className="size-val">{originalW} x {originalH} pixels ({originalMem} MB)</span>
              </div>
              <div className="size-row">
                <span className="size-label">New Size:</span>
                <span className="size-val">{targetW} x {targetH} pixels ({newMem} MB)</span>
              </div>
              {resample && (
                <div className="size-row">
                  <span className="size-label">Scale:</span>
                  <span className="size-val">{scalePercentX}% W / {scalePercentY}% H</span>
                </div>
              )}
            </div>

            <hr className="divider-line" />

            {/* Inputs grid */}
            <div className="canvas-size-section new-size-inputs">
              <span className="section-title">Dimensions:</span>

              <div className="image-size-controls-container">
                <div className="inputs-column">
                  <div className="input-row">
                    <span className="input-label">Width:</span>
                    <input
                      type="number"
                      step="any"
                      value={widthInput}
                      onChange={e => handleWidthChange(e.target.value)}
                      className="size-num-input"
                    />
                    <select
                      value={widthUnit}
                      onChange={e => setWidthUnit(e.target.value as any)}
                      className="size-unit-select"
                    >
                      <option value="px">Pixels</option>
                      <option value="percent">Percent</option>
                      <option value="in">Inches</option>
                      <option value="cm">Centimeters</option>
                      <option value="mm">Millimeters</option>
                    </select>
                  </div>

                  <div className="input-row" style={{ marginTop: '0.75rem' }}>
                    <span className="input-label">Height:</span>
                    <input
                      type="number"
                      step="any"
                      value={heightInput}
                      onChange={e => handleHeightChange(e.target.value)}
                      className="size-num-input"
                    />
                    <select
                      value={heightUnit}
                      onChange={e => setHeightUnit(e.target.value as any)}
                      className="size-unit-select"
                    >
                      <option value="px">Pixels</option>
                      <option value="percent">Percent</option>
                      <option value="in">Inches</option>
                      <option value="cm">Centimeters</option>
                      <option value="mm">Millimeters</option>
                    </select>
                  </div>
                </div>

                {/* Lock column */}
                {resample && (
                  <div className="lock-column">
                    <button
                      onClick={() => setMaintainAspect(!maintainAspect)}
                      className={`constrain-lock-btn ${maintainAspect ? 'active' : ''}`}
                      title="Maintain Aspect Ratio"
                    >
                      {maintainAspect ? (
                        <LucideIcons.Link size={18} />
                      ) : (
                        <LucideIcons.Link2 size={18} style={{ opacity: 0.5 }} />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <hr className="divider-line" />

            {/* Resolution Row */}
            <div className="canvas-size-section resolution-section">
              <div className="input-row">
                <span className="input-label">Resolution:</span>
                <input
                  type="number"
                  step="any"
                  value={resolutionInput}
                  onChange={e => handleResolutionChange(e.target.value)}
                  className="size-num-input"
                />
                <span className="resolution-unit-label">Pixels/Inch</span>
              </div>
            </div>

            <hr className="divider-line" />

            {/* Resampling Row */}
            <div className="canvas-size-section resampling-section">
              <div className="relative-checkbox-row">
                <input
                  type="checkbox"
                  id="resample-toggle"
                  checked={resample}
                  onChange={e => handleResampleToggle(e.target.checked)}
                />
                <label htmlFor="resample-toggle" className="checkbox-label">Resample</label>
              </div>

              {resample && (
                <div className="resampling-row" style={{ marginTop: '0.5rem' }}>
                  <select
                    value={resamplingMethod}
                    onChange={e => setResamplingMethod(e.target.value as any)}
                    className="resampling-select"
                    style={{ width: '100%' }}
                  >
                    <option value="bicubic">Bicubic (best for smooth gradients)</option>
                    <option value="bilinear">Bilinear (standard interpolation)</option>
                    <option value="nearest">Nearest Neighbor (preserve hard edges / pixel art)</option>
                    <option value="lanczos">Lanczos (high-quality downscaling)</option>
                    <option value="high-quality">High Quality (browser accelerated)</option>
                  </select>
                </div>
              )}
            </div>

            <div className="relative-checkbox-row" style={{ marginTop: '0.75rem' }}>
              <input
                type="checkbox"
                id="image-preview-toggle"
                checked={showPreview}
                onChange={e => setShowPreview(e.target.checked)}
              />
              <label htmlFor="image-preview-toggle" className="checkbox-label">Preview</label>
            </div>

          </div>

          {/* Real-time Resampling Preview Canvas */}
          <div className="canvas-size-preview-panel">
            <span className="section-title">Resampling Preview:</span>
            <div className="preview-canvas-wrapper" style={{ height: '180px' }}>
              <canvas ref={previewCanvasRef} width={200} height={180} className="preview-canvas-element" />
            </div>
            <div className="preview-help-text" style={{ fontSize: '10px', color: '#888', marginTop: '0.5rem', lineHeight: '1.2' }}>
              Shows a 40x40 pixel center region resampled to fit the preview panel, demonstrating exact interpolation quality.
            </div>
          </div>

        </div>

        <div className="dialog-footer">
          <button className="btn-secondary" onClick={() => setIsImageSizeDialogOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleOK}>OK</button>
        </div>
      </motion.div>
    </div>
  );
};
