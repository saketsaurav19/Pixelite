import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import './Dialogs.css';

const PRESETS = [
  { name: 'Default Photoshop Size', width: 1600, height: 1200 },
  { name: '1080p (FHD)', width: 1920, height: 1080 },
  { name: '720p (HD)', width: 1280, height: 720 },
  { name: 'Instagram Square', width: 1080, height: 1080 },
  { name: 'Instagram Story', width: 1080, height: 1920 },
  { name: 'A4 Document (300dpi)', width: 2480, height: 3508 },
];

export const NewDocumentDialog: React.FC = () => {
  const { isNewDocumentDialogOpen, setIsNewDocumentDialogOpen, setDocumentSize, setLayers, recordHistory, setCurrentProjectId, setHistory } = useStore();
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [backgroundType, setBackgroundType] = useState<'white' | 'transparent'>('white');

  if (!isNewDocumentDialogOpen) return null;

  const handleCreate = () => {
    setCurrentProjectId(null);
    setHistory([], 0);
    setDocumentSize({ w: width, h: height });

    if (backgroundType === 'white') {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        setLayers([{
          id: Math.random().toString(36).substring(7),
          name: 'Background',
          type: 'paint',
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: 'source-over',
          position: { x: 0, y: 0 },
          dataUrl: canvas.toDataURL()
        }]);
      }
    } else {
       setLayers([{
          id: Math.random().toString(36).substring(7),
          name: 'Layer 1',
          type: 'paint',
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: 'source-over',
          position: { x: 0, y: 0 }
        }]);
    }

    recordHistory('New Document');
    setIsNewDocumentDialogOpen(false);
  };

  return (
    <div className="dialog-overlay" onClick={() => setIsNewDocumentDialogOpen(false)}>
      <div className="dialog-content" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>New Document</h2>
          <button className="dialog-close" onClick={() => setIsNewDocumentDialogOpen(false)}>
            <LucideIcons.X size={20} />
          </button>
        </div>

        <div className="dialog-body new-doc-body">
          <div className="presets-sidebar">
            <h3>Presets</h3>
            <div className="preset-list">
              {PRESETS.map(preset => (
                <button
                  key={preset.name}
                  className="preset-item"
                  onClick={() => {
                    setWidth(preset.width);
                    setHeight(preset.height);
                  }}
                >
                  <div className="preset-name">{preset.name}</div>
                  <div className="preset-dims">{preset.width} x {preset.height} px</div>
                </button>
              ))}
            </div>
          </div>

          <div className="doc-settings">
            <div className="setting-group">
              <label>Width (px)</label>
              <input type="number" value={width} onChange={e => setWidth(Number(e.target.value))} />
            </div>
            <div className="setting-group">
              <label>Height (px)</label>
              <input type="number" value={height} onChange={e => setHeight(Number(e.target.value))} />
            </div>

            <div className="setting-group">
              <label>Background Contents</label>
              <select value={backgroundType} onChange={e => setBackgroundType(e.target.value as any)}>
                <option value="white">White</option>
                <option value="transparent">Transparent</option>
              </select>
            </div>
          </div>
        </div>

        <div className="dialog-footer">
          <button className="btn-secondary" onClick={() => setIsNewDocumentDialogOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleCreate}>Create</button>
        </div>
      </div>
    </div>
  );
};
