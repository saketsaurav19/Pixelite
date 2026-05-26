import React from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import './Dialogs.css';

export const FileInfoDialog: React.FC = () => {
  const { isFileInfoDialogOpen, setIsFileInfoDialogOpen, documentSize, layers } = useStore();

  if (!isFileInfoDialogOpen) return null;

  return (
    <div className="dialog-overlay" onClick={() => setIsFileInfoDialogOpen(false)}>
      <div className="dialog-content" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>File Information</h2>
          <button className="dialog-close" onClick={() => setIsFileInfoDialogOpen(false)}>
            <LucideIcons.X size={20} />
          </button>
        </div>

        <div className="dialog-body">
            <div className="info-grid">
                <div className="info-row">
                    <span className="info-label">Dimensions:</span>
                    <span className="info-value">{documentSize.w} x {documentSize.h} pixels</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Color Profile:</span>
                    <span className="info-value">sRGB IEC61966-2.1 (Simulated)</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Total Layers:</span>
                    <span className="info-value">{layers.length}</span>
                </div>
                <div className="info-row">
                    <span className="info-label">Approx Memory:</span>
                    <span className="info-value">{Math.round((documentSize.w * documentSize.h * 4 * layers.length) / 1024 / 1024)} MB (Uncompressed Buffers)</span>
                </div>
            </div>

            <p className="info-note">Advanced EXIF and ICC profile editing will be available in a future update.</p>
        </div>

        <div className="dialog-footer">
          <button className="btn-primary" onClick={() => setIsFileInfoDialogOpen(false)}>OK</button>
        </div>
      </div>
    </div>
  );
};
