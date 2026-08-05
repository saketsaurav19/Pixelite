import React, { useState, useEffect, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { motion, useDragControls } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { CanvasSizeService } from '../../services/image/CanvasSizeService';
import './Dialogs.css';


const convertPixelsToUnit = (pixels: number, unit: string, currentSize: number): number => {
  switch (unit) {
    case 'px':
      return Math.round(pixels);
    case 'percent':
      return Math.round((pixels / currentSize) * 100 * 100) / 100;
    default:
      return Math.round(pixels);
  }
};

const convertUnitToPixels = (value: number, unit: string, currentSize: number): number => {
  switch (unit) {
    case 'px':
      return Math.round(value);
    case 'percent':
      return Math.round((value / 100) * currentSize);
    default:
      return Math.round(value);
  }
};

const getArrowSymbol = (cell: string, selected: string) => {
  if (cell === selected) {
    return '■';
  }

  const cells = [
    ['top-left', 'top-center', 'top-right'],
    ['middle-left', 'center', 'middle-right'],
    ['bottom-left', 'bottom-center', 'bottom-right']
  ];

  let selRow = -1, selCol = -1;
  let cellRow = -1, cellCol = -1;

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (cells[r][c] === selected) {
        selRow = r;
        selCol = c;
      }
      if (cells[r][c] === cell) {
        cellRow = r;
        cellCol = c;
      }
    }
  }

  if (selRow === -1 || cellRow === -1) return '';

  const dr = cellRow - selRow;
  const dc = cellCol - selCol;

  if (dr === 0 && dc === 0) return '■';
  if (dr < 0 && dc < 0) return '↖';
  if (dr < 0 && dc === 0) return '↑';
  if (dr < 0 && dc > 0) return '↗';
  if (dr === 0 && dc < 0) return '←';
  if (dr === 0 && dc > 0) return '→';
  if (dr > 0 && dc < 0) return '↙';
  if (dr > 0 && dc === 0) return '↓';
  if (dr > 0 && dc > 0) return '↘';

  return '';
};

export const CanvasSizeDialog: React.FC = () => {
  const dragControls = useDragControls();
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const {
    isCanvasSizeDialogOpen,
    setIsCanvasSizeDialogOpen,
    documentSize,
    setDocumentSize,
    layers,
    setLayers,
    recordHistory,
    addAlert
  } = useStore();

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [widthUnit, setWidthUnit] = useState<'px' | 'percent'>('px');
  const [heightUnit, setHeightUnit] = useState<'px' | 'percent'>('px');

  const [widthInput, setWidthInput] = useState('0');
  const [heightInput, setHeightInput] = useState('0');

  const [relative, setRelative] = useState(false);
  const [anchor, setAnchor] = useState('center');
  const [extensionColor, setExtensionColor] = useState('Transparent');
  const [customColor, setCustomColor] = useState('#ffffff');
  
  const [showPreview, setShowPreview] = useState(true);

  const [constrainProportions, setConstrainProportions] = useState(false);

  // Initialize form fields when dialog opens
  useEffect(() => {
    if (isCanvasSizeDialogOpen) {
      setWidthUnit('px');
      setHeightUnit('px');
      setWidthInput(documentSize.w.toString());
      setHeightInput(documentSize.h.toString());
      setRelative(false);
      setAnchor('center');
      setExtensionColor('Transparent');
      setCustomColor('#ffffff');
      setShowPreview(true);
      setConstrainProportions(false);
    }
  }, [isCanvasSizeDialogOpen, documentSize]);

  const handleWidthChange = (val: string) => {
    setWidthInput(val);
    const parsedW = parseFloat(val) || 0;
    if (constrainProportions && parsedW > 0) {
      const aspect = documentSize.w / documentSize.h;
      if (relative) {
        const pxW = convertUnitToPixels(parsedW, widthUnit, documentSize.w);
        const pxH = pxW / aspect;
        const convertedH = convertPixelsToUnit(pxH, heightUnit, documentSize.h);
        setHeightInput(convertedH.toString());
      } else {
        const pxW = convertUnitToPixels(parsedW, widthUnit, documentSize.w);
        const pxH = pxW / aspect;
        const convertedH = convertPixelsToUnit(pxH, heightUnit, documentSize.h);
        setHeightInput(convertedH.toString());
      }
    }
  };

  const handleHeightChange = (val: string) => {
    setHeightInput(val);
    const parsedH = parseFloat(val) || 0;
    if (constrainProportions && parsedH > 0) {
      const aspect = documentSize.w / documentSize.h;
      if (relative) {
        const pxH = convertUnitToPixels(parsedH, heightUnit, documentSize.h);
        const pxW = pxH * aspect;
        const convertedW = convertPixelsToUnit(pxW, widthUnit, documentSize.w);
        setWidthInput(convertedW.toString());
      } else {
        const pxH = convertUnitToPixels(parsedH, heightUnit, documentSize.h);
        const pxW = pxH * aspect;
        const convertedW = convertPixelsToUnit(pxW, widthUnit, documentSize.w);
        setWidthInput(convertedW.toString());
      }
    }
  };

  const handleWidthUnitChange = (newUnit: typeof widthUnit) => {
    const pixels = convertUnitToPixels(parseFloat(widthInput) || 0, widthUnit, documentSize.w);
    const converted = convertPixelsToUnit(pixels, newUnit, documentSize.w);
    setWidthUnit(newUnit);
    setWidthInput(converted.toString());
  };

  const handleHeightUnitChange = (newUnit: typeof heightUnit) => {
    const pixels = convertUnitToPixels(parseFloat(heightInput) || 0, heightUnit, documentSize.h);
    const converted = convertPixelsToUnit(pixels, newUnit, documentSize.h);
    setHeightUnit(newUnit);
    setHeightInput(converted.toString());
  };

  // Compute targets
  const getTargetDimensions = () => {
    let targetW = documentSize.w;
    let targetH = documentSize.h;

    const rawW = parseFloat(widthInput) || 0;
    const rawH = parseFloat(heightInput) || 0;

    if (relative) {
      const deltaW = convertUnitToPixels(rawW, widthUnit, documentSize.w);
      const deltaH = convertUnitToPixels(rawH, heightUnit, documentSize.h);
      targetW = Math.max(1, documentSize.w + deltaW);
      targetH = Math.max(1, documentSize.h + deltaH);
    } else {
      targetW = Math.max(1, convertUnitToPixels(rawW, widthUnit, documentSize.w));
      targetH = Math.max(1, convertUnitToPixels(rawH, heightUnit, documentSize.h));
    }

    return { targetW, targetH };
  };

  const { targetW, targetH } = getTargetDimensions();

  // Draw Live Preview
  useEffect(() => {
    if (!isCanvasSizeDialogOpen || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear preview canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!showPreview) {
      // Draw placeholder
      ctx.fillStyle = '#222';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#666';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Preview Disabled', canvas.width / 2, canvas.height / 2);
      return;
    }

    const pad = 20;
    const maxAreaW = canvas.width - 2 * pad;
    const maxAreaH = canvas.height - 2 * pad;

    const oldW = documentSize.w;
    const oldH = documentSize.h;

    // Calculate scale factor to fit both old & new canvas bounds
    const maxDim = Math.max(oldW, targetW, oldH, targetH);
    const scale = maxDim > 0 ? Math.min(maxAreaW / maxDim, maxAreaH / maxDim) : 1;

    const oldScaledW = oldW * scale;
    const oldScaledH = oldH * scale;
    const newScaledW = targetW * scale;
    const newScaledH = targetH * scale;

    // Center layout inside canvas
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const anchorOffset = CanvasSizeService.getAnchorOffset(oldW, oldH, targetW, targetH, anchor);
    const dx = anchorOffset.x * scale;
    const dy = anchorOffset.y * scale;

    // Center the NEW canvas in the preview area
    const newX = cx - newScaledW / 2;
    const newY = cy - newScaledH / 2;

    // Position the OLD canvas relative to the new canvas using anchor offset
    const oldX = newX + dx;
    const oldY = newY + dy;

    // Draw checkerboard background for preview canvas bounds
    ctx.save();
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Draw grid checkerboard inside new canvas area to represent transparency
    ctx.save();
    ctx.beginPath();
    ctx.rect(newX, newY, newScaledW, newScaledH);
    ctx.clip();

    // Checkerboard
    const chkSize = 8;
    for (let py = newY; py < newY + newScaledH; py += chkSize) {
      for (let px = newX; px < newX + newScaledW; px += chkSize) {
        ctx.fillStyle = (Math.floor(px / chkSize) + Math.floor(py / chkSize)) % 2 === 0 ? '#444' : '#555';
        ctx.fillRect(px, py, chkSize, chkSize);
      }
    }

    // Fill with canvas extension color if any (not transparent)
    let fill = 'transparent';
    if (extensionColor === 'White') fill = '#ffffff';
    else if (extensionColor === 'Black') fill = '#000000';
    else if (extensionColor === 'Gray') fill = '#808080';
    else if (extensionColor === 'Custom...') fill = customColor;
    else if (extensionColor === 'Foreground') fill = useStore.getState().foregroundColor || '#ffffff';
    else if (extensionColor === 'Background') fill = useStore.getState().backgroundColor || '#000000';

    if (fill !== 'transparent') {
      ctx.fillStyle = fill;
      ctx.fillRect(newX, newY, newScaledW, newScaledH);
    }
    ctx.restore();

    // Draw original image boundaries (Old Canvas)
    ctx.save();
    // Crop area logic: intersection of old and new bounds
    const intersectX = Math.max(oldX, newX);
    const intersectY = Math.max(oldY, newY);
    const intersectRight = Math.min(oldX + oldScaledW, newX + newScaledW);
    const intersectBottom = Math.min(oldY + oldScaledH, newY + newScaledH);

    // Draw preserved original image area
    if (intersectRight > intersectX && intersectBottom > intersectY) {
      ctx.fillStyle = '#007acc55'; // semi-transparent blue for original content
      ctx.fillRect(intersectX, intersectY, intersectRight - intersectX, intersectBottom - intersectY);
      ctx.strokeStyle = '#0088ff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(intersectX, intersectY, intersectRight - intersectX, intersectBottom - intersectY);
    }

    // Draw cropped out areas in semi-transparent red
    ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    // Top crop
    if (newY > oldY) {
      ctx.fillRect(oldX, oldY, oldScaledW, newY - oldY);
      ctx.strokeRect(oldX, oldY, oldScaledW, newY - oldY);
    }
    // Bottom crop
    if (newY + newScaledH < oldY + oldScaledH) {
      ctx.fillRect(oldX, newY + newScaledH, oldScaledW, (oldY + oldScaledH) - (newY + newScaledH));
      ctx.strokeRect(oldX, newY + newScaledH, oldScaledW, (oldY + oldScaledH) - (newY + newScaledH));
    }
    // Left crop
    if (newX > oldX) {
      ctx.fillRect(oldX, oldY, newX - oldX, oldScaledH);
      ctx.strokeRect(oldX, oldY, newX - oldX, oldScaledH);
    }
    // Right crop
    if (newX + newScaledW < oldX + oldScaledW) {
      ctx.fillRect(newX + newScaledW, oldY, (oldX + oldScaledW) - (newX + newScaledW), oldScaledH);
      ctx.strokeRect(newX + newScaledW, oldY, (oldX + oldScaledW) - (newX + newScaledW), oldScaledH);
    }
    ctx.restore();

    // Draw borders of the new canvas
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(newX, newY, newScaledW, newScaledH);

    // Labels
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('New Canvas Bounds', newX, newY - 4);
  }, [isCanvasSizeDialogOpen, documentSize, targetW, targetH, anchor, extensionColor, customColor, showPreview]);

  const handleOK = async () => {
    const anchorOffset = CanvasSizeService.getAnchorOffset(
      documentSize.w,
      documentSize.h,
      targetW,
      targetH,
      anchor
    );
    const dx = anchorOffset.x;
    const dy = anchorOffset.y;

    // Resolve color
    let fill = 'transparent';
    if (extensionColor === 'White') fill = '#ffffff';
    else if (extensionColor === 'Black') fill = '#000000';
    else if (extensionColor === 'Gray') fill = '#808080';
    else if (extensionColor === 'Custom...') fill = customColor;
    else if (extensionColor === 'Foreground') fill = useStore.getState().foregroundColor || '#ffffff';
    else if (extensionColor === 'Background') fill = useStore.getState().backgroundColor || '#000000';

    const isShrinking = targetW < documentSize.w || targetH < documentSize.h;

    // Map through layers and modify positions / crop pixel contents
    const updatedLayers = await Promise.all(
      layers.map(async (layer) => {
        const oldPos = layer.position || { x: 0, y: 0 };
        const newX = oldPos.x + dx;
        const newY = oldPos.y + dy;

        // Background Layer Resize logic (solid color expansion or crop)
        const isBg = layer.name.toLowerCase() === 'background';

        if (isBg) {
          return new Promise<any>((resolve) => {
            const img = new Image();
            img.onload = () => {
              const bgCanvas = CanvasSizeService.resizeBackgroundLayer(img, dx, dy, targetW, targetH, fill);
              resolve({
                ...layer,
                position: { x: 0, y: 0 },
                width: targetW,
                height: targetH,
                dataUrl: bgCanvas.toDataURL()
              });
            };
            img.onerror = () => {
              // If fails, draw colored canvas from scratch
              const bgCanvas = CanvasSizeService.resizeBackgroundLayer(null, 0, 0, targetW, targetH, fill);
              resolve({
                ...layer,
                position: { x: 0, y: 0 },
                width: targetW,
                height: targetH,
                dataUrl: bgCanvas.toDataURL()
              });
            };
            img.src = layer.dataUrl || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
          });
        }

        // If shrinking, crop layer image if it has pixel data
        if (isShrinking && layer.dataUrl) {
          return new Promise<any>((resolve) => {
            const img = new Image();
            img.onload = () => {
              const cropped = CanvasSizeService.cropLayerImage(img, { x: newX, y: newY }, targetW, targetH);
              resolve({
                ...layer,
                position: cropped.position,
                width: cropped.width,
                height: cropped.height,
                dataUrl: cropped.dataUrl || layer.dataUrl
              });
            };
            img.onerror = () => {
              resolve({
                ...layer,
                position: { x: newX, y: newY }
              });
            };
            img.src = layer.dataUrl!;
          });
        }

        // Default root layer shift only
        return {
          ...layer,
          position: { x: newX, y: newY }
        };
      })
    );

    setLayers(updatedLayers);
    setDocumentSize({ w: targetW, h: targetH });
    recordHistory('Canvas Size');

    if (addAlert) {
      addAlert({
        type: 'success',
        message: `Canvas size changed to ${targetW} x ${targetH} px.`
      });
    }

    setIsCanvasSizeDialogOpen(false);
  };

  if (!isCanvasSizeDialogOpen) return null;

  return (
    <div className="dialog-overlay" onClick={() => setIsCanvasSizeDialogOpen(false)}>
      <motion.div
        drag={!isMobile}
        dragControls={isMobile ? undefined : dragControls}
        dragListener={false}
        dragMomentum={false}
        dragElastic={0}
        className="dialog-content canvas-size-dialog"
        onClick={e => e.stopPropagation()}
        style={isMobile ? {} : { maxWidth: '44rem' }}
      >
        <div 
          className="dialog-header drag-handle" 
          onPointerDown={(e) => !isMobile && dragControls.start(e)}
          style={{ cursor: isMobile ? 'default' : 'grab' }}
        >
          <h2>Canvas Size</h2>
          <button className="dialog-close" onClick={() => setIsCanvasSizeDialogOpen(false)}>
            <LucideIcons.X size={20} />
          </button>
        </div>

        <div className="dialog-body canvas-size-body-split">
          
          {/* Controls section */}
          <div className="canvas-size-controls">
            
            {/* Current Size Section */}
            <div className="canvas-size-section current-size-info">
              <span className="section-title">Current Size:</span>
              <div className="size-row">
                <span className="size-label">Width:</span>
                <span className="size-val">{documentSize.w} pixels ({convertPixelsToUnit(documentSize.w, 'in', documentSize.w)} in)</span>
              </div>
              <div className="size-row">
                <span className="size-label">Height:</span>
                <span className="size-val">{documentSize.h} pixels ({convertPixelsToUnit(documentSize.h, 'in', documentSize.h)} in)</span>
              </div>
            </div>

            <hr className="divider-line" />

            {/* New Size Section */}
            <div className="canvas-size-section new-size-inputs">
              <span className="section-title">New Size:</span>
              
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
                      onChange={e => handleWidthUnitChange(e.target.value as any)}
                      className="size-unit-select"
                    >
                      <option value="px">Pixels</option>
                      <option value="percent">Percent</option>
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
                      onChange={e => handleHeightUnitChange(e.target.value as any)}
                      className="size-unit-select"
                    >
                      <option value="px">Pixels</option>
                      <option value="percent">Percent</option>
                    </select>
                  </div>
                </div>

                <div className="lock-column">
                  <button
                    onClick={() => setConstrainProportions(!constrainProportions)}
                    className={`constrain-lock-btn ${constrainProportions ? 'active' : ''}`}
                    title="Maintain Aspect Ratio"
                  >
                    {constrainProportions ? (
                      <LucideIcons.Link size={18} />
                    ) : (
                      <LucideIcons.Link2 size={18} style={{ opacity: 0.5 }} />
                    )}
                  </button>
                </div>
              </div>

              <div className="relative-checkbox-row">
                <input
                  type="checkbox"
                  id="relative-toggle"
                  checked={relative}
                  onChange={e => {
                    setRelative(e.target.checked);
                    setWidthInput(e.target.checked ? '0' : documentSize.w.toString());
                    setHeightInput(e.target.checked ? '0' : documentSize.h.toString());
                  }}
                />
                <label htmlFor="relative-toggle" className="checkbox-label">Relative</label>
              </div>
            </div>

            <hr className="divider-line" />

            {/* Anchor Selector Grid */}
            <div className="canvas-size-section anchor-grid-section">
              <span className="section-title">Anchor:</span>
              
              <div className="anchor-grid-container">
                <div className="anchor-grid">
                  {[
                    ['top-left', 'top-center', 'top-right'],
                    ['middle-left', 'center', 'middle-right'],
                    ['bottom-left', 'bottom-center', 'bottom-right']
                  ].map((row, rIdx) => (
                    <div className="anchor-row" key={rIdx}>
                      {row.map((cell) => (
                        <button
                          key={cell}
                          className={`anchor-cell ${anchor === cell ? 'active' : ''}`}
                          onClick={() => setAnchor(cell)}
                        >
                          {getArrowSymbol(cell, anchor)}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Canvas extension color */}
            <div className="canvas-size-section extension-color-section">
              <span className="section-title">Canvas extension color:</span>
              <div className="extension-color-row">
                <select
                  value={extensionColor}
                  onChange={e => setExtensionColor(e.target.value)}
                  className="extension-color-select"
                >
                  <option value="Transparent">Transparent</option>
                  <option value="White">White</option>
                  <option value="Black">Black</option>
                  <option value="Gray">Gray</option>
                  <option value="Foreground">Foreground Color</option>
                  <option value="Background">Background Color</option>
                  <option value="Custom...">Custom...</option>
                </select>

                {extensionColor === 'Custom...' && (
                  <input
                    type="color"
                    value={customColor}
                    onChange={e => setCustomColor(e.target.value)}
                    className="custom-color-picker"
                  />
                )}
              </div>
            </div>

            <div className="relative-checkbox-row" style={{ marginTop: '0.75rem' }}>
              <input
                type="checkbox"
                id="preview-toggle"
                checked={showPreview}
                onChange={e => setShowPreview(e.target.checked)}
              />
              <label htmlFor="preview-toggle" className="checkbox-label">Preview</label>
            </div>

          </div>

          {/* Visual Live Preview Canvas section */}
          <div className="canvas-size-preview-panel">
            <span className="section-title">Live Preview layout:</span>
            <div className="preview-canvas-wrapper">
              <canvas ref={previewCanvasRef} width={220} height={220} className="preview-canvas-element" />
            </div>
            <div className="preview-legend">
              <div className="legend-item"><span className="legend-dot original" /> Original Bounds</div>
              <div className="legend-item"><span className="legend-dot target" /> New Bounds</div>
              <div className="legend-item"><span className="legend-dot cropped" /> Cropped Areas</div>
            </div>
          </div>

        </div>

        <div className="dialog-footer">
          <button className="btn-secondary" onClick={() => setIsCanvasSizeDialogOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleOK}>OK</button>
        </div>
      </motion.div>
    </div>
  );
};
