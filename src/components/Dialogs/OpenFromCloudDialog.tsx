import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import * as LucideIcons from 'lucide-react';
import './Dialogs.css';
import { ImportEngine } from '../../services/import/ImportEngine';

export const OpenFromCloudDialog: React.FC = () => {
  const {
    isOpenFromCloudDialogOpen,
    setIsOpenFromCloudDialogOpen,
    setLayers,
    setDocumentSize,
    layers,
    recordHistory
  } = useStore();

  const [url, setUrl] = useState('');
  const [isNewProject, setIsNewProject] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpenFromCloudDialogOpen) return null;

  const handleOpen = async () => {
    if (!url.trim()) {
      setError('Please enter a valid URL.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch the image to convert it to a blob and then data URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const blob = await response.blob();

      // Convert blob to file so we can reuse ImportEngine
      const fileName = url.split('/').pop() || 'cloud-image.png';
      const file = new File([blob], fileName, { type: blob.type });

      const result = await ImportEngine.importFile(file);

      if (result.type === 'image' && result.dataUrl) {
        const isDefaultBackground =
          layers.length === 1 && layers[0].name === 'Background' && layers[0].type === 'paint';

        if (isNewProject || layers.length === 0 || isDefaultBackground) {
          setDocumentSize({ w: result.width, h: result.height });
          setLayers([{
            id: Math.random().toString(36).substring(7),
            name: result.name,
            type: 'image',
            dataUrl: result.dataUrl,
            position: { x: 0, y: 0 },
            visible: true,
            locked: false,
            opacity: 1,
            blendMode: 'source-over'
          }]);
          recordHistory(`Open ${result.name} from Cloud`);
        } else {
          setLayers([...layers, {
            id: Math.random().toString(36).substring(7),
            name: result.name,
            type: 'image',
            dataUrl: result.dataUrl,
            position: {
              x: (useStore.getState().documentSize.w - result.width) / 2,
              y: (useStore.getState().documentSize.h - result.height) / 2
            },
            visible: true,
            locked: false,
            opacity: 1,
            blendMode: 'source-over'
          }]);
          recordHistory(`Place ${result.name} from Cloud`);
        }

        // Success
        setIsOpenFromCloudDialogOpen(false);
        setUrl('');
        setIsNewProject(false);
      } else {
          throw new Error('Could not parse image from URL');
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load image from URL. It may be restricted by CORS.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={() => !isLoading && setIsOpenFromCloudDialogOpen(false)}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()} style={{ width: '400px' }}>
        <div className="dialog-header">
          <h3>Open from Cloud</h3>
          <button className="dialog-close" onClick={() => !isLoading && setIsOpenFromCloudDialogOpen(false)} disabled={isLoading}>
            <LucideIcons.X size={18} />
          </button>
        </div>

        <div className="dialog-body">
          <div className="setting-group" style={{ marginBottom: '16px' }}>
            <label>Image URL</label>
            <input
              type="text"
              placeholder="https://example.com/image.png"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
              autoFocus
              style={{ width: '100%', boxSizing: 'border-box', marginTop: '4px', padding: '8px', borderRadius: '4px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }}
            />
          </div>

          <div className="setting-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="new-project-checkbox"
              checked={isNewProject}
              onChange={(e) => setIsNewProject(e.target.checked)}
              disabled={isLoading}
            />
            <label htmlFor="new-project-checkbox" style={{ margin: 0, cursor: 'pointer' }}>Create as New Project</label>
          </div>

          <div style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
            {isNewProject ?
              "This will replace your current workspace with the new image." :
              "This will place the image as a new layer in your current workspace."}
          </div>

          {error && (
            <div style={{ color: '#ff6b6b', marginTop: '16px', fontSize: '14px' }}>
              {error}
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn-secondary" onClick={() => setIsOpenFromCloudDialogOpen(false)} disabled={isLoading}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleOpen} disabled={isLoading || !url.trim()}>
            {isLoading ? 'Loading...' : (isNewProject ? 'Open Image' : 'Place Image')}
          </button>
        </div>
      </div>
    </div>
  );
};
