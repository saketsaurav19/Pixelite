import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { motion, useDragControls } from 'framer-motion';
import { useStore } from '../../store/useStore';
import './Dialogs.css';

const DPI = 72;

const convertPixelsToUnit = (pixels: number, unit: string, currentSize: number): number => {
  switch (unit) {
    case 'px':
      return Math.round(pixels);
    case 'percent':
      return Math.round((pixels / currentSize) * 100 * 100) / 100;
    case 'in':
      return Math.round((pixels / DPI) * 100) / 100;
    case 'cm':
      return Math.round((pixels / (DPI / 2.54)) * 100) / 100;
    case 'mm':
      return Math.round((pixels / (DPI / 25.4)) * 10) / 10;
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
    case 'in':
      return Math.round(value * DPI);
    case 'cm':
      return Math.round(value * (DPI / 2.54));
    case 'mm':
      return Math.round(value * (DPI / 25.4));
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

  let selR = 1, selC = 1;
  let cellR = 0, cellC = 0;

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (cells[r][c] === selected) {
        selR = r;
        selC = c;
      }
      if (cells[r][c] === cell) {
        cellR = r;
        cellC = c;
      }
    }
  }

  const dr = cellR - selR;
  const dc = cellC - selC;

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
  const {
    isCanvasSizeDialogOpen,
    setIsCanvasSizeDialogOpen,
    documentSize,
    setDocumentSize,
    layers,
    setLayers,
    recordHistory,
    addAlert,
    brushColor,
    secondaryColor
  } = useStore();

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [widthUnit, setWidthUnit] = useState<'px' | 'percent' | 'in' | 'cm' | 'mm'>('px');
  const [heightUnit, setHeightUnit] = useState<'px' | 'percent' | 'in' | 'cm' | 'mm'>('px');

  const [widthInput, setWidthInput] = useState('0');
  const [heightInput, setHeightInput] = useState('0');

  const [relative, setRelative] = useState(false);
  const [anchor, setAnchor] = useState<string>('center');
  const [extensionColor, setExtensionColor] = useState<string>('transparent');
  const [customColor, setCustomColor] = useState<string>('#ffffff');

  // Initialize input values when dialog opens
  useEffect(() => {
    if (isCanvasSizeDialogOpen) {
      setRelative(false);
      setWidthUnit('px');
      setHeightUnit('px');
      setWidthInput(documentSize.w.toString());
      setHeightInput(documentSize.h.toString());
      setAnchor('center');
      setExtensionColor('transparent');
    }
  }, [isCanvasSizeDialogOpen, documentSize]);

  if (!isCanvasSizeDialogOpen) return null;

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

  const handleRelativeToggle = (checked: boolean) => {
    setRelative(checked);
    if (checked) {
      setWidthInput('0');
      setHeightInput('0');
    } else {
      setWidthInput(convertPixelsToUnit(documentSize.w, widthUnit, documentSize.w).toString());
      setHeightInput(convertPixelsToUnit(documentSize.h, heightUnit, documentSize.h).toString());
    }
  };

  const handleOK = async () => {
    let targetW = documentSize.w;
    let targetH = documentSize.h;

    if (relative) {
      const deltaW = convertUnitToPixels(parseFloat(widthInput) || 0, widthUnit, documentSize.w);
      const deltaH = convertUnitToPixels(parseFloat(heightInput) || 0, heightUnit, documentSize.h);
      targetW = Math.max(1, documentSize.w + deltaW);
      targetH = Math.max(1, documentSize.h + deltaH);
    } else {
      targetW = Math.max(1, convertUnitToPixels(parseFloat(widthInput) || 0, widthUnit, documentSize.w));
      targetH = Math.max(1, convertUnitToPixels(parseFloat(heightInput) || 0, heightUnit, documentSize.h));
    }

    const diffW = targetW - documentSize.w;
    const diffH = targetH - documentSize.h;

    let dx = 0;
    let dy = 0;

    if (anchor.includes('center')) {
      dx = Math.round(diffW / 2);
    } else if (anchor.includes('right')) {
      dx = diffW;
    } else {
      dx = 0;
    }

    if (anchor.startsWith('middle') || anchor === 'center') {
      dy = Math.round(diffH / 2);
    } else if (anchor.startsWith('bottom')) {
      dy = diffH;
    } else {
      dy = 0;
    }

    let fillColor = 'transparent';
    if (extensionColor === 'white') fillColor = '#ffffff';
    else if (extensionColor === 'black') fillColor = '#000000';
    else if (extensionColor === 'gray') fillColor = '#808080';
    else if (extensionColor === 'foreground') fillColor = brushColor || '#000000';
    else if (extensionColor === 'background') fillColor = secondaryColor || '#ffffff';
    else if (extensionColor === 'custom') fillColor = customColor;

    // Process layer resizing / positioning
    const resizePromises = layers.map(layer => {
      const isBackground = layer.name.toLowerCase() === 'background';

      if (isBackground) {
        return new Promise<typeof layer>((resolve) => {
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(layer);
            return;
          }

          if (fillColor !== 'transparent') {
            ctx.fillStyle = fillColor;
            ctx.fillRect(0, 0, targetW, targetH);
          } else {
            ctx.clearRect(0, 0, targetW, targetH);
          }

          if (layer.dataUrl) {
            const img = new Image();
            img.onload = () => {
              ctx.drawImage(img, dx, dy);
              resolve({
                ...layer,
                position: { x: 0, y: 0 },
                dataUrl: canvas.toDataURL(),
                width: targetW,
                height: targetH
              });
            };
            img.onerror = () => {
              resolve(layer);
            };
            img.src = layer.dataUrl;
          } else {
            resolve({
              ...layer,
              position: { x: 0, y: 0 },
              dataUrl: canvas.toDataURL(),
              width: targetW,
              height: targetH
            });
          }
        });
      } else {
        // Shift non-background root level layers
        const currentX = layer.position?.x || 0;
        const currentY = layer.position?.y || 0;
        return Promise.resolve({
          ...layer,
          position: { x: currentX + dx, y: currentY + dy }
        });
      }
    });

    const newLayers = await Promise.all(resizePromises);
    setLayers(newLayers);
    setDocumentSize({ w: targetW, h: targetH });
    recordHistory('Canvas Size');
    
    if (addAlert) {
      addAlert({
        type: 'success',
        message: `Canvas resized to ${targetW} x ${targetH} px.`
      });
    }

    setIsCanvasSizeDialogOpen(false);
  };

  const gridCells = [
    ['top-left', 'top-center', 'top-right'],
    ['middle-left', 'center', 'middle-right'],
    ['bottom-left', 'bottom-center', 'bottom-right']
  ];

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
        style={isMobile ? {} : { maxWidth: '30rem' }}
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

        <div className="dialog-body canvas-size-body">
          {/* Current Size Section */}
          <div className="canvas-size-section current-size-info">
            <span className="section-title">Current Size:</span>
            <div className="size-row">
              <span className="size-label">Width:</span>
              <span className="size-val">{documentSize.w} pixels ({convertPixelsToUnit(documentSize.w, 'in', documentSize.w)} inches)</span>
            </div>
            <div className="size-row">
              <span className="size-label">Height:</span>
              <span className="size-val">{documentSize.h} pixels ({convertPixelsToUnit(documentSize.h, 'in', documentSize.h)} inches)</span>
            </div>
          </div>

          <hr className="divider-line" />

          {/* New Size Section */}
          <div className="canvas-size-section new-size-inputs">
            <span className="section-title">New Size:</span>
            <div className="input-row">
              <span className="input-label">Width:</span>
              <input
                type="number"
                step="any"
                value={widthInput}
                onChange={e => setWidthInput(e.target.value)}
                className="size-num-input"
              />
              <select
                value={widthUnit}
                onChange={e => handleWidthUnitChange(e.target.value as any)}
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
                onChange={e => setHeightInput(e.target.value)}
                className="size-num-input"
              />
              <select
                value={heightUnit}
                onChange={e => handleHeightUnitChange(e.target.value as any)}
                className="size-unit-select"
              >
                <option value="px">Pixels</option>
                <option value="percent">Percent</option>
                <option value="in">Inches</option>
                <option value="cm">Centimeters</option>
                <option value="mm">Millimeters</option>
              </select>
            </div>

            <label className="relative-checkbox-label" style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={relative}
                onChange={e => handleRelativeToggle(e.target.checked)}
                className="relative-checkbox"
              />
              <span>Relative</span>
            </label>
          </div>

          <hr className="divider-line" />

          {/* Anchor grid & extension color section */}
          <div className="canvas-size-section anchor-color-section">
            <div className="anchor-selector-container">
              <span className="section-title" style={{ display: 'block', marginBottom: '0.5rem' }}>Anchor:</span>
              <div className="anchor-grid">
                {gridCells.map((row, rIdx) => (
                  <div key={rIdx} className="anchor-grid-row">
                    {row.map(cell => (
                      <button
                        key={cell}
                        onClick={() => setAnchor(cell)}
                        className={`anchor-cell ${anchor === cell ? 'active' : ''}`}
                        title={cell.replace('-', ' ')}
                      >
                        {getArrowSymbol(cell, anchor)}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="extension-color-container">
              <span className="section-title" style={{ display: 'block', marginBottom: '0.5rem' }}>Canvas extension color:</span>
              <div className="extension-color-row">
                <select
                  value={extensionColor}
                  onChange={e => setExtensionColor(e.target.value)}
                  className="extension-color-select"
                >
                  <option value="transparent">Transparent</option>
                  <option value="white">White</option>
                  <option value="black">Black</option>
                  <option value="gray">Gray</option>
                  <option value="foreground">Foreground Color</option>
                  <option value="background">Background Color</option>
                  <option value="custom">Custom...</option>
                </select>

                {extensionColor === 'custom' && (
                  <input
                    type="color"
                    value={customColor}
                    onChange={e => setCustomColor(e.target.value)}
                    className="custom-color-picker"
                  />
                )}
              </div>
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
