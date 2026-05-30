import React, { useState, useEffect, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import { ExportEngine } from '../../services/export/ExportEngine';
import './Dialogs.css';

export const ExportAsDialog: React.FC = () => {
  const { isExportDialogOpen, setIsExportDialogOpen, documentSize, layers, addAlert, exportFormat, exifData, iccProfile } = useStore();
  const [format, setFormat] = useState<'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml' | 'image/gif' | 'application/pdf'>(exportFormat);
  const [quality, setQuality] = useState(100);
  const [name, setName] = useState('New Project');
  const [width, setWidth] = useState(documentSize.w);
  const [height, setHeight] = useState(documentSize.h);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const [dontUsePalettes, setDontUsePalettes] = useState(false);
  const [attachMetadata, setAttachMetadata] = useState(false);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Sync format when opened from menu
  useEffect(() => {
    if (isExportDialogOpen) {
      setFormat(exportFormat);
      setWidth(documentSize.w);
      setHeight(documentSize.h);
    }
  }, [isExportDialogOpen, exportFormat, documentSize]);

  useEffect(() => {
    if (isExportDialogOpen && previewCanvasRef.current) {
        // Render a flattened preview
        const previewCanvas = previewCanvasRef.current;
        previewCanvas.width = documentSize.w;
        previewCanvas.height = documentSize.h;
        const ctx = previewCanvas.getContext('2d');
        if (ctx) {
             ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
             [...layers].reverse().forEach(layer => {
                if (layer.visible) {
                    const layerCanvas = document.querySelector(`canvas[data-layer-id="${layer.id}"]`) as HTMLCanvasElement;
                    if (layerCanvas) {
                        ctx.drawImage(layerCanvas, layer.position.x, layer.position.y);
                    }
                }
             });
        }
    }
  }, [isExportDialogOpen, documentSize, layers]);

  const handleWidthChange = (val: number) => {
    setWidth(val);
    if (maintainAspectRatio) {
      setHeight(Math.round(val * (documentSize.h / documentSize.w)));
    }
  };

  const handleHeightChange = (val: number) => {
    setHeight(val);
    if (maintainAspectRatio) {
      setWidth(Math.round(val * (documentSize.w / documentSize.h)));
    }
  };

  if (!isExportDialogOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
        const tempCanvas = document.createElement('canvas');
        const targetWidth = width;
        const targetHeight = height;

        tempCanvas.width = targetWidth;
        tempCanvas.height = targetHeight;

        const scaleX = targetWidth / documentSize.w;
        const scaleY = targetHeight / documentSize.h;

        const ctx = tempCanvas.getContext('2d');
        if (ctx) {
             // Basic flatten logic for export
             if (format === 'image/jpeg') {
                 ctx.fillStyle = '#ffffff';
                 ctx.fillRect(0,0, targetWidth, targetHeight);
             }
             [...layers].reverse().forEach(layer => {
                if (layer.visible) {
                    const layerCanvas = document.querySelector(`canvas[data-layer-id="${layer.id}"]`) as HTMLCanvasElement;
                    if (layerCanvas) {
                        ctx.drawImage(layerCanvas, layer.position.x * scaleX, layer.position.y * scaleY, layerCanvas.width * scaleX, layerCanvas.height * scaleY);
                    }
                }
             });
        }

        const actualFormat = (format === 'image/svg+xml' || format === 'image/gif' || format === 'application/pdf') ? 'image/png' : format;

        await ExportEngine.downloadExport(tempCanvas, {
            exifData: attachMetadata ? exifData : undefined,
            iccProfile: attachMetadata ? iccProfile : undefined,
            format: actualFormat as any,
            quality: quality / 100,
            filename: `${name || 'export'}.${actualFormat.split('/')[1]}`
        });
        setIsExportDialogOpen(false);
    } catch (error) {
        console.error("Export failed", error);
        addAlert({ type: 'error', message: 'Export failed. See console.' });
    } finally {
        setIsExporting(false);
    }
  };

  // Estimate file size
  const estimateSize = () => {
     let bytes = width * height * 4; // Uncompressed size roughly
     if (format === 'image/jpeg' || format === 'image/webp') {
         bytes = bytes * (quality / 100) * 0.1;
     } else if (format === 'image/png') {
         bytes = bytes * 0.5;
     }

     const kb = Math.round(bytes / 1024);
     return { kb, bytes: Math.round(bytes) };
  };

  const estimatedSize = estimateSize();

  return (
    <div className="dialog-overlay" onClick={() => setIsExportDialogOpen(false)}>
      <div className="dialog-content export-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Save for web</h2>
          <button className="dialog-close" onClick={() => setIsExportDialogOpen(false)}>
            <LucideIcons.X size={20} />
          </button>
        </div>

        <div className="dialog-body export-body">
            <div className="export-preview-container">
                <div className="export-preview">
                    <canvas ref={previewCanvasRef} className="preview-canvas" />
                </div>
                <div className="export-preview-footer">
                    <span className="export-zoom">100%</span>
                    <span className="export-size">{estimatedSize.kb.toLocaleString()} KB  {estimatedSize.bytes.toLocaleString()} B</span>
                </div>
            </div>

            <div className="export-settings">
                <div className="export-row-2">
                    <div className="setting-group" style={{flex: 2}}>
                        <label>Name</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div className="setting-group" style={{flex: 1}}>
                        <label>Format</label>
                        <select value={format} onChange={e => setFormat(e.target.value as any)}>
                            <option value="image/png">PNG</option>
                            <option value="image/jpeg">JPG</option>
                            <option value="image/webp">WEBP</option>
                            <option value="image/svg+xml">SVG</option>
                            <option value="image/gif">GIF</option>
                            <option value="application/pdf">PDF</option>
                        </select>
                    </div>
                </div>

                <div className="export-row-dims">
                    <div className="setting-group">
                        <label>Width</label>
                        <input type="number" value={width} onChange={e => handleWidthChange(Number(e.target.value))} />
                    </div>

                    <div className="link-button-container">
                        <label>&nbsp;</label>
                        <button
                            className={`link-button ${maintainAspectRatio ? 'active' : ''}`}
                            onClick={() => setMaintainAspectRatio(!maintainAspectRatio)}
                            title="Maintain Aspect Ratio"
                        >
                            <LucideIcons.Link size={16} />
                        </button>
                    </div>

                    <div className="setting-group">
                        <label>Height</label>
                        <input type="number" value={height} onChange={e => handleHeightChange(Number(e.target.value))} />
                    </div>

                    <div className="setting-group">
                        <label>&nbsp;</label>
                        <select className="unit-select">
                            <option value="px">px</option>
                            <option value="%">%</option>
                        </select>
                    </div>
                </div>

                <div className="setting-group quality-group">
                    <div className="quality-header">
                        <label>Quality:</label>
                        <span>{quality}%</span>
                    </div>
                    <input type="range" min="1" max="100" value={quality} onChange={e => setQuality(Number(e.target.value))} />
                </div>

                <div className="export-checkboxes">
                    <label className="checkbox-label">
                        <input type="checkbox" checked={dontUsePalettes} onChange={e => setDontUsePalettes(e.target.checked)} />
                        don't use palettes
                    </label>
                    <label className="checkbox-label">
                        <input type="checkbox" checked={attachMetadata} onChange={e => setAttachMetadata(e.target.checked)} />
                        attach metadata
                    </label>
                </div>

                <div className="export-actions">
                    <button className="btn-save" onClick={handleExport} disabled={isExporting}>
                        {isExporting ? 'Saving...' : 'Save'}
                    </button>
                    <button className="btn-more" onClick={() => {}} title="More Options">
                        ...
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
