import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import * as LucideIcons from 'lucide-react';
import './Dialogs.css';

export const MobileCameraDialog: React.FC = () => {
  const {
    mobileCapturedImage,
    setMobileCapturedImage,
    layers,
    setLayers,
    documentSize,
    setDocumentSize,
    recordHistory
  } = useStore();

  const [createNewProject, setCreateNewProject] = useState<boolean>(false);

  if (!mobileCapturedImage) return null;

  const handleClose = () => {
    setMobileCapturedImage(null);
  };

  const handleConfirm = () => {
    const img = new Image();
    img.onload = () => {
      const isDefaultBackground = layers.length === 1 && layers[0].name === 'Background' && layers[0].type === 'paint';
      const shouldReplace = createNewProject || (layers.length === 0 || isDefaultBackground);

      if (shouldReplace) {
        setDocumentSize({ w: img.width, h: img.height });
        setLayers([{
          id: Math.random().toString(36).substring(7),
          name: 'Camera Image',
          type: 'image',
          dataUrl: mobileCapturedImage,
          position: { x: 0, y: 0 },
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: 'source-over'
        }]);
      } else {
        setLayers([...layers, {
          id: Math.random().toString(36).substring(7),
          name: 'Camera Image',
          type: 'image',
          dataUrl: mobileCapturedImage,
          position: {
            x: (documentSize.w - img.width) / 2,
            y: (documentSize.h - img.height) / 2
          },
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: 'source-over'
        }]);
      }
      recordHistory('Take Picture (Mobile)');
      handleClose();
    };
    img.src = mobileCapturedImage;
  };

  const retakePhoto = () => {
    handleClose();
    // We could trigger the hidden input again, but user can just click Take Picture again
  };

  return (
    <div className="dialog-overlay" onMouseDown={handleClose}>
      <div className="dialog-content camera-dialog" onMouseDown={(e) => e.stopPropagation()} style={{ width: '400px', maxWidth: '90vw' }}>
        <div className="dialog-header">
          <h2>Photo Preview</h2>
          <button className="dialog-close" onClick={handleClose}>
            <LucideIcons.X size={18} />
          </button>
        </div>

        <div className="dialog-body" style={{ padding: '20px' }}>
          <div style={{
            position: 'relative',
            width: '100%',
            backgroundColor: '#1a1a1a',
            overflow: 'hidden',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '400px',
            borderRadius: '4px',
            border: '1px solid #333',
            backgroundImage: `url(${mobileCapturedImage})`,
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}>
          </div>
        </div>

        <div className="dialog-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
            <input
              type="checkbox"
              checked={createNewProject}
              onChange={(e) => setCreateNewProject(e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#0066cc' }}
            />
            <span style={{ fontSize: '13px', color: '#ccc' }}>Create New Project</span>
          </label>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn-secondary" onClick={retakePhoto}>Retake</button>
            <button className="btn-primary" onClick={handleConfirm}>Confirm</button>
          </div>
        </div>
      </div>
    </div>
  );
};
