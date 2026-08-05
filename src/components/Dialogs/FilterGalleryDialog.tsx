import React, { useState, useEffect, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { motion, useDragControls } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { findLayerById } from '../../utils/layerUtils';
import { FilterService } from '../../services/image/FilterService';
import './Dialogs.css';

const FILTER_TYPES = [
  { value: 'gaussian_blur', label: 'Gaussian Blur' },
  { value: 'motion_blur', label: 'Motion Blur' },
  { value: 'blur', label: 'Blur (Standard)' },
  { value: 'average', label: 'Average Blur' },
  { value: 'oil_paint', label: 'Oil Paint' },
  { value: 'sharpen', label: 'Sharpen' },
  { value: 'sharpen_more', label: 'Sharpen More' },
  { value: 'unsharp_mask', label: 'Unsharp Mask' },
  { value: 'emboss', label: 'Emboss' },
  { value: 'find_edges', label: 'Find Edges' },
  { value: 'ripple', label: 'Ripple Distort' },
  { value: 'wave', label: 'Wave Distort' },
  { value: 'pinch', label: 'Pinch Distort' },
  { value: 'add_noise', label: 'Add Noise' },
  { value: 'dust_scratches', label: 'Dust & Scratches' },
  { value: 'median', label: 'Median' },
  { value: 'high_pass', label: 'High Pass' },
  { value: 'maximum', label: 'Maximum' },
  { value: 'minimum', label: 'Minimum' }
];

export const FilterGalleryDialog: React.FC = () => {
  const dragControls = useDragControls();
  const {
    isFilterGalleryDialogOpen,
    setIsFilterGalleryDialogOpen,
    filterGallerySelectedType,
    activeLayerId,
    updateLayer,
    recordHistory,
    addAlert,
    selectionRect,
    lassoPaths,
    isInverseSelection,
    layers
  } = useStore();

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedFilter, setSelectedFilter] = useState('gaussian_blur');

  // Sliders state
  const [radius, setRadius] = useState(5);
  const [angle, setAngle] = useState(0);
  const [amount, setAmount] = useState(100);
  const [strength, setStrength] = useState(1.5);
  const [wavelength, setWavelength] = useState(30);
  const [amplitude, setAmplitude] = useState(10);
  const [frequency, setFrequency] = useState(20);
  const [intensity, setIntensity] = useState(10);

  // Original preview image buffer (200x200)
  const [previewBaseImageData, setPreviewBaseImageData] = useState<ImageData | null>(null);
  const [scaleRatio, setScaleRatio] = useState(1);

  // Offscreen backup canvas for the full-resolution layer
  const [backupCanvas, setBackupCanvas] = useState<HTMLCanvasElement | null>(null);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync selected filter type when store updates it (e.g. from Menu selection)
  useEffect(() => {
    if (isFilterGalleryDialogOpen && filterGallerySelectedType) {
      const normType = filterGallerySelectedType.toLowerCase();
      if (normType === 'filter_gallery') {
        setSelectedFilter('oil_paint');
      } else {
        setSelectedFilter(normType);
      }
    }
  }, [isFilterGalleryDialogOpen, filterGallerySelectedType]);

  // Load preview and backup canvases when dialog opens
  useEffect(() => {
    if (!isFilterGalleryDialogOpen || !activeLayerId) return;

    const layerCanvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
    if (!layerCanvas) return;

    // 1. Create backup of original full-res layer canvas
    const backup = document.createElement('canvas');
    backup.width = layerCanvas.width;
    backup.height = layerCanvas.height;
    const backupCtx = backup.getContext('2d');
    if (backupCtx) {
      backupCtx.drawImage(layerCanvas, 0, 0);
      setBackupCanvas(backup);
    }

    // 2. Create small 200x200 offscreen preview canvas
    const size = 200;
    const offscreen = document.createElement('canvas');
    offscreen.width = size;
    offscreen.height = size;
    const oCtx = offscreen.getContext('2d');
    if (!oCtx) return;

    const ratio = layerCanvas.width / layerCanvas.height;
    let drawW = size;
    let drawH = size;
    if (ratio > 1) {
      drawH = size / ratio;
    } else {
      drawW = size * ratio;
    }

    oCtx.drawImage(layerCanvas, 0, 0, layerCanvas.width, layerCanvas.height, (size - drawW) / 2, (size - drawH) / 2, drawW, drawH);
    const imgData = oCtx.getImageData(0, 0, size, size);
    setPreviewBaseImageData(imgData);
    setScaleRatio(drawW / layerCanvas.width);

    // Clean up states when opening
    setRadius(5);
    setAngle(0);
    setAmount(100);
    setStrength(1.5);
    setWavelength(30);
    setAmplitude(10);
    setFrequency(20);
    setIntensity(10);
  }, [isFilterGalleryDialogOpen, activeLayerId]);

  // Main canvas real-time update & dialog thumbnail update
  useEffect(() => {
    if (!previewBaseImageData || !previewCanvasRef.current || !activeLayerId || !backupCanvas) return;

    const layerCanvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
    if (!layerCanvas) return;

    const previewCanvas = previewCanvasRef.current;
    const previewCtx = previewCanvas.getContext('2d');
    if (!previewCtx) return;

    // 1. Render on local thumbnail canvas (using scaleRatio for visual parity)
    const previewRadius = Math.max(1, Math.round(radius * scaleRatio));
    const previewWavelength = Math.max(1, Math.round(wavelength * scaleRatio));
    const previewAmplitude = Math.max(1, Math.round(amplitude * scaleRatio));
    const previewFrequency = Math.max(1, Math.round(frequency * scaleRatio));

    let previewResult: ImageData | null = null;
    try {
      switch (selectedFilter) {
        case 'average':
          previewResult = FilterService.average(previewBaseImageData);
          break;
        case 'blur':
          previewResult = FilterService.boxBlur(previewBaseImageData, previewRadius);
          break;
        case 'gaussian_blur':
          previewResult = FilterService.boxBlur(previewBaseImageData, previewRadius);
          break;
        case 'motion_blur':
          previewResult = FilterService.motionBlur(previewBaseImageData, previewRadius, angle);
          break;
        case 'displace':
          previewResult = FilterService.ripple(previewBaseImageData, 40, previewAmplitude);
          break;
        case 'pinch':
          previewResult = FilterService.pinch(previewBaseImageData, strength);
          break;
        case 'ripple':
          previewResult = FilterService.ripple(previewBaseImageData, previewWavelength, previewAmplitude);
          break;
        case 'wave':
          previewResult = FilterService.wave(previewBaseImageData, previewFrequency, previewAmplitude);
          break;
        case 'add_noise':
          previewResult = FilterService.addNoise(previewBaseImageData, amount);
          break;
        case 'dust_scratches':
          previewResult = FilterService.median(previewBaseImageData, previewRadius);
          break;
        case 'median':
          previewResult = FilterService.median(previewBaseImageData, previewRadius);
          break;
        case 'sharpen':
          previewResult = FilterService.convolve(previewBaseImageData, [0, -1, 0, -1, 5, -1, 0, -1, 0]);
          break;
        case 'sharpen_more':
          previewResult = FilterService.convolve(previewBaseImageData, [-1, -1, -1, -1, 9, -1, -1, -1, -1]);
          break;
        case 'unsharp_mask':
          previewResult = FilterService.unsharpMask(previewBaseImageData, previewRadius, amount);
          break;
        case 'emboss':
          previewResult = FilterService.convolve(previewBaseImageData, [-2, -1, 0, -1, 1, 1, 0, 1, 2], 128);
          break;
        case 'find_edges':
          previewResult = FilterService.convolve(previewBaseImageData, [-1, -1, -1, -1, 8, -1, -1, -1, -1]);
          break;
        case 'oil_paint':
          previewResult = FilterService.oilPaint(previewBaseImageData, previewRadius, intensity);
          break;
        case 'high_pass':
          previewResult = FilterService.highPass(previewBaseImageData, previewRadius);
          break;
        case 'maximum':
          previewResult = FilterService.minMax(previewBaseImageData, previewRadius, true);
          break;
        case 'minimum':
          previewResult = FilterService.minMax(previewBaseImageData, previewRadius, false);
          break;
        default:
          previewResult = previewBaseImageData;
      }
    } catch (e) {
      console.error('[Filter Preview Error]:', e);
      previewResult = previewBaseImageData;
    }

    if (previewResult) {
      previewCtx.putImageData(previewResult, 0, 0);
    }

    // 2. Render on the actual layer canvas in real-time
    const layerCtx = layerCanvas.getContext('2d');
    if (!layerCtx) return;

    // Reset actual layer to original state before filter application
    layerCtx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
    layerCtx.drawImage(backupCanvas, 0, 0);

    const backupCtx = backupCanvas.getContext('2d');
    if (!backupCtx) return;

    const actualImageData = backupCtx.getImageData(0, 0, backupCanvas.width, backupCanvas.height);
    let actualResult: ImageData | null = null;

    try {
      switch (selectedFilter) {
        case 'average':
          actualResult = FilterService.average(actualImageData);
          break;
        case 'blur':
          actualResult = FilterService.boxBlur(actualImageData, radius);
          break;
        case 'gaussian_blur':
          actualResult = FilterService.boxBlur(actualImageData, radius);
          break;
        case 'motion_blur':
          actualResult = FilterService.motionBlur(actualImageData, radius, angle);
          break;
        case 'displace':
          actualResult = FilterService.ripple(actualImageData, 40, amplitude);
          break;
        case 'pinch':
          actualResult = FilterService.pinch(actualImageData, strength);
          break;
        case 'ripple':
          actualResult = FilterService.ripple(actualImageData, wavelength, amplitude);
          break;
        case 'wave':
          actualResult = FilterService.wave(actualImageData, frequency, amplitude);
          break;
        case 'add_noise':
          actualResult = FilterService.addNoise(actualImageData, amount);
          break;
        case 'dust_scratches':
          actualResult = FilterService.median(actualImageData, radius);
          break;
        case 'median':
          actualResult = FilterService.median(actualImageData, radius);
          break;
        case 'sharpen':
          actualResult = FilterService.convolve(actualImageData, [0, -1, 0, -1, 5, -1, 0, -1, 0]);
          break;
        case 'sharpen_more':
          actualResult = FilterService.convolve(actualImageData, [-1, -1, -1, -1, 9, -1, -1, -1, -1]);
          break;
        case 'unsharp_mask':
          actualResult = FilterService.unsharpMask(actualImageData, radius, amount);
          break;
        case 'emboss':
          actualResult = FilterService.convolve(actualImageData, [-2, -1, 0, -1, 1, 1, 0, 1, 2], 128);
          break;
        case 'find_edges':
          actualResult = FilterService.convolve(actualImageData, [-1, -1, -1, -1, 8, -1, -1, -1, -1]);
          break;
        case 'oil_paint':
          actualResult = FilterService.oilPaint(actualImageData, radius, intensity);
          break;
        case 'high_pass':
          actualResult = FilterService.highPass(actualImageData, radius);
          break;
        case 'maximum':
          actualResult = FilterService.minMax(actualImageData, radius, true);
          break;
        case 'minimum':
          actualResult = FilterService.minMax(actualImageData, radius, false);
          break;
      }
    } catch (e) {
      console.error('[Filter Actual Render Error]:', e);
    }

    if (actualResult) {
      const temp = document.createElement('canvas');
      temp.width = layerCanvas.width;
      temp.height = layerCanvas.height;
      temp.getContext('2d')!.putImageData(actualResult, 0, 0);

      layerCtx.save();
      if (selectionRect) {
        const layer = activeLayerId ? findLayerById(layers, activeLayerId) : undefined;
        const offX = layer?.position.x || 0;
        const offY = layer?.position.y || 0;
        layerCtx.beginPath();
        if (isInverseSelection) layerCtx.rect(0, 0, layerCanvas.width, layerCanvas.height);
        layerCtx.rect(selectionRect.x - offX, selectionRect.y - offY, selectionRect.w, selectionRect.h);
        layerCtx.clip(isInverseSelection ? 'evenodd' : 'nonzero');
      } else if (lassoPaths && lassoPaths.length > 0) {
        const layer = activeLayerId ? findLayerById(layers, activeLayerId) : undefined;
        const offX = layer?.position.x || 0;
        const offY = layer?.position.y || 0;
        layerCtx.beginPath();
        if (isInverseSelection) layerCtx.rect(0, 0, layerCanvas.width, layerCanvas.height);
        lassoPaths.forEach(path => {
          if (path.length < 3) return;
          layerCtx.moveTo(path[0].x - offX, path[0].y - offY);
          path.forEach(p => layerCtx.lineTo(p.x - offX, p.y - offY));
          layerCtx.closePath();
        });
        layerCtx.clip('evenodd');
      }

      layerCtx.drawImage(temp, 0, 0);
      layerCtx.restore();
    }
  }, [previewBaseImageData, backupCanvas, selectedFilter, radius, angle, amount, strength, wavelength, amplitude, frequency, intensity]);

  if (!isFilterGalleryDialogOpen) return null;

  const handleApply = () => {
    const layerCanvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
    if (layerCanvas) {
      updateLayer(activeLayerId, { dataUrl: layerCanvas.toDataURL() });
      recordHistory(`Filter: ${selectedFilter}`);
      addAlert({ type: 'success', message: `${selectedFilter} filter applied.` });
    }
    setIsFilterGalleryDialogOpen(false);
  };

  const handleCancel = () => {
    // Restore original pixels on the active layer canvas
    const layerCanvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
    if (layerCanvas && backupCanvas) {
      const layerCtx = layerCanvas.getContext('2d');
      if (layerCtx) {
        layerCtx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
        layerCtx.drawImage(backupCanvas, 0, 0);
      }
    }
    setIsFilterGalleryDialogOpen(false);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const filter = e.target.value;
    setSelectedFilter(filter);
    
    if (filter === 'gaussian_blur') setRadius(5);
    else if (filter === 'motion_blur') { setRadius(10); setAngle(0); }
    else if (filter === 'pinch') setStrength(1.5);
    else if (filter === 'ripple') { setWavelength(30); setAmplitude(10); }
    else if (filter === 'wave') { setFrequency(20); setAmplitude(10); }
    else if (filter === 'add_noise') setAmount(15);
    else if (filter === 'median' || filter === 'dust_scratches') setRadius(2);
    else if (filter === 'unsharp_mask') { setRadius(2); setAmount(100); }
    else if (filter === 'oil_paint') { setRadius(2); setIntensity(10); }
    else if (filter === 'high_pass') setRadius(10);
    else if (filter === 'maximum' || filter === 'minimum') setRadius(3);
  };

  // Render dynamic parameter sliders
  const renderControls = () => {
    switch (selectedFilter) {
      case 'gaussian_blur':
      case 'blur':
      case 'dust_scratches':
      case 'median':
      case 'high_pass':
      case 'maximum':
      case 'minimum': {
        const isIntOnly = selectedFilter === 'median' || selectedFilter === 'dust_scratches' || selectedFilter === 'maximum' || selectedFilter === 'minimum';
        return (
          <div className="dialog-control-group">
            <label>Radius (Pixels): {radius}px</label>
            <input
              type="range"
              min="1"
              max={isIntOnly ? '10' : '50'}
              step="1"
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value))}
            />
          </div>
        );
      }
      case 'motion_blur':
        return (
          <>
            <div className="dialog-control-group">
              <label>Radius (Pixels): {radius}px</label>
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={radius}
                onChange={(e) => setRadius(parseInt(e.target.value))}
              />
            </div>
            <div className="dialog-control-group">
              <label>Angle (Degrees): {angle}°</label>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={angle}
                onChange={(e) => setAngle(parseInt(e.target.value))}
              />
            </div>
          </>
        );
      case 'pinch':
        return (
          <div className="dialog-control-group">
            <label>Strength: {strength.toFixed(1)}</label>
            <input
              type="range"
              min="-3.0"
              max="5.0"
              step="0.1"
              value={strength}
              onChange={(e) => setStrength(parseFloat(e.target.value))}
            />
          </div>
        );
      case 'ripple':
        return (
          <>
            <div className="dialog-control-group">
              <label>Wavelength: {wavelength}px</label>
              <input
                type="range"
                min="5"
                max="150"
                step="1"
                value={wavelength}
                onChange={(e) => setWavelength(parseInt(e.target.value))}
              />
            </div>
            <div className="dialog-control-group">
              <label>Amplitude: {amplitude}px</label>
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={amplitude}
                onChange={(e) => setAmplitude(parseInt(e.target.value))}
              />
            </div>
          </>
        );
      case 'wave':
        return (
          <>
            <div className="dialog-control-group">
              <label>Frequency: {frequency}px</label>
              <input
                type="range"
                min="5"
                max="100"
                step="1"
                value={frequency}
                onChange={(e) => setFrequency(parseInt(e.target.value))}
              />
            </div>
            <div className="dialog-control-group">
              <label>Amplitude: {amplitude}px</label>
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={amplitude}
                onChange={(e) => setAmplitude(parseInt(e.target.value))}
              />
            </div>
          </>
        );
      case 'add_noise':
        return (
          <div className="dialog-control-group">
            <label>Amount: {amount}%</label>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value))}
            />
          </div>
        );
      case 'unsharp_mask':
        return (
          <>
            <div className="dialog-control-group">
              <label>Radius: {radius}px</label>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={radius}
                onChange={(e) => setRadius(parseInt(e.target.value))}
              />
            </div>
            <div className="dialog-control-group">
              <label>Amount: {amount}%</label>
              <input
                type="range"
                min="10"
                max="500"
                step="5"
                value={amount}
                onChange={(e) => setAmount(parseInt(e.target.value))}
              />
            </div>
          </>
        );
      case 'oil_paint':
        return (
          <>
            <div className="dialog-control-group">
              <label>Radius: {radius}px</label>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={radius}
                onChange={(e) => setRadius(parseInt(e.target.value))}
              />
            </div>
            <div className="dialog-control-group">
              <label>Intensity: {intensity}</label>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={intensity}
                onChange={(e) => setIntensity(parseInt(e.target.value))}
              />
            </div>
          </>
        );
      default:
        return <p className="dialog-no-controls">This filter has no adjustable parameters.</p>;
    }
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
        style={isMobile ? {} : { width: '560px' }}
      >
        <div 
          className="dialog-header drag-handle" 
          onPointerDown={(e) => !isMobile && dragControls.start(e)}
          style={{ cursor: isMobile ? 'default' : 'grab' }}
        >
          <h3>Filter Gallery</h3>
          <button className="dialog-close" onClick={handleCancel}>
            <LucideIcons.X size={18} />
          </button>
        </div>

        <div className="dialog-body" style={{ display: 'flex', gap: '20px', padding: '20px' }}>
          {/* Left column: Live Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '220px' }}>
            <div
              style={{
                width: '202px',
                height: '202px',
                border: '1px solid var(--border-color, #3a3f44)',
                borderRadius: '4px',
                overflow: 'hidden',
                backgroundColor: '#1e1e1e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
              }}
            >
              <canvas ref={previewCanvasRef} width={200} height={200} style={{ display: 'block' }} />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted, #8a9095)', marginTop: '8px' }}>
              Interactive Gallery Preview
            </span>
          </div>

          {/* Right column: Options & sliders */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div className="dialog-control-group">
              <label htmlFor="filter-select">Choose Filter</label>
              <select
                id="filter-select"
                value={selectedFilter}
                onChange={handleFilterChange}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: 'var(--input-bg, #2b2b2b)',
                  color: 'var(--input-color, #ffffff)',
                  border: '1px solid var(--border-color, #3f3f3f)',
                  borderRadius: '4px',
                  outline: 'none',
                }}
              >
                {FILTER_TYPES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: 'rgba(0,0,0,0.15)',
                border: '1px solid var(--border-color, #333)',
                borderRadius: '4px',
                minHeight: '130px',
              }}
            >
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600 }}>Filter Settings</h4>
              {renderControls()}
            </div>
          </div>
        </div>

        <div className="dialog-footer" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleApply}>
            Apply Filter
          </button>
        </div>
      </motion.div>
    </div>
  );
};
