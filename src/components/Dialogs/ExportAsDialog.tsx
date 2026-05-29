import React, { useState, useEffect, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import { ExportEngine } from '../../services/export/ExportEngine';
import './Dialogs.css';

export const ExportAsDialog: React.FC = () => {
  const { isExportDialogOpen, setIsExportDialogOpen, documentSize, layers, addAlert } = useStore();
  const [format, setFormat] = useState<'image/png' | 'image/jpeg' | 'image/webp'>('image/png');
  const [quality, setQuality] = useState(92);
  const [scale, setScale] = useState(100);
  const [isExporting, setIsExporting] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

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

  if (!isExportDialogOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
        const tempCanvas = document.createElement('canvas');
        const targetWidth = Math.round(documentSize.w * (scale / 100));
        const targetHeight = Math.round(documentSize.h * (scale / 100));

        tempCanvas.width = targetWidth;
        tempCanvas.height = targetHeight;

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
                        ctx.drawImage(layerCanvas, layer.position.x * (scale/100), layer.position.y * (scale/100), layerCanvas.width * (scale/100), layerCanvas.height * (scale/100));
                    }
                }
             });
        }

        await ExportEngine.downloadExport(tempCanvas, {
            format,
            quality: quality / 100,
            filename: `export.${format.split('/')[1]}`
        });
        setIsExportDialogOpen(false);
    } catch (error) {
        console.error("Export failed", error);
        addAlert({ type: 'error', message: 'Export failed. See console.' });
    } finally {
        setIsExporting(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={() => setIsExportDialogOpen(false)}>
      <div className="dialog-content export-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Export As</h2>
          <button className="dialog-close" onClick={() => setIsExportDialogOpen(false)}>
            <LucideIcons.X size={20} />
          </button>
        </div>

        <div className="dialog-body export-body">
            <div className="export-preview">
                <canvas ref={previewCanvasRef} className="preview-canvas" style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', background: 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAADFJREFUOE9jZCASMDKgCHb29v5HgAEYjUaDYTRgMBoMBoMhwIABnQ3AwE4YTYNBNBgAAGe9CRB2a1/uAAAAAElFTkSuQmCC") repeat' }} />
            </div>

            <div className="export-settings">
                <div className="setting-group">
                    <label>Format</label>
                    <select value={format} onChange={e => setFormat(e.target.value as any)}>
                        <option value="image/png">PNG</option>
                        <option value="image/jpeg">JPEG</option>
                        <option value="image/webp">WEBP</option>
                    </select>
                </div>

                {(format === 'image/jpeg' || format === 'image/webp') && (
                     <div className="setting-group">
                        <label>Quality: {quality}%</label>
                        <input type="range" min="1" max="100" value={quality} onChange={e => setQuality(Number(e.target.value))} />
                     </div>
                )}

                <div className="setting-group">
                    <label>Scale: {scale}%</label>
                    <input type="range" min="10" max="200" value={scale} onChange={e => setScale(Number(e.target.value))} />
                    <div className="scale-dims">
                        {Math.round(documentSize.w * (scale / 100))} x {Math.round(documentSize.h * (scale / 100))} px
                    </div>
                </div>
            </div>
        </div>

        <div className="dialog-footer">
          <button className="btn-secondary" onClick={() => setIsExportDialogOpen(false)} disabled={isExporting}>Cancel</button>
          <button className="btn-primary" onClick={handleExport} disabled={isExporting}>
             {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
};
