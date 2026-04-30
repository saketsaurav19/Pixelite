import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import './Modals.css';

interface CloudStorageModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider?: string;
  onSave: (provider: string, filename: string) => Promise<void>;
  defaultFilename?: string;
}

const PROVIDERS = [
  { id: 'google_drive', name: 'Google Drive', icon: 'Cloud' },
  { id: 'dropbox', name: 'Dropbox', icon: 'Box' },
  { id: 'onedrive', name: 'OneDrive', icon: 'CloudRain' },
];

export const CloudStorageModal: React.FC<CloudStorageModalProps> = ({
  isOpen,
  onClose,
  provider,
  onSave,
  defaultFilename = 'project.png'
}) => {
  const [selectedProvider, setSelectedProvider] = useState(provider || PROVIDERS[0].id);
  const [filename, setFilename] = useState(defaultFilename);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'saving' | 'success'>('idle');

  useEffect(() => {
    if (provider) setSelectedProvider(provider);
  }, [provider]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setStatus('connecting');
    try {
      await onSave(selectedProvider, filename);
      setStatus('success');
    } catch (err) {
      setStatus('idle');
      // Error is handled in App.tsx via alert, but we could also show it here
    }
  };

  const getProviderIcon = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName] || LucideIcons.Cloud;
    return <Icon size={24} />;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Save to Cloud Storage</h3>
          <button className="modal-close-btn" onClick={onClose}>
            <LucideIcons.X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {status === 'success' ? (
            <div className="success-state">
              <div className="success-icon">
                <LucideIcons.CheckCircle size={40} />
              </div>
              <h4>File Saved Successfully!</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Your file "<strong>{filename}</strong>" has been uploaded to {PROVIDERS.find(p => p.id === selectedProvider)?.name}.
              </p>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>Select Provider</label>
                <div className="provider-grid">
                  {PROVIDERS.map((p) => (
                    <div
                      key={p.id}
                      className={`provider-card ${selectedProvider === p.id ? 'selected' : ''}`}
                      onClick={() => status === 'idle' && setSelectedProvider(p.id)}
                    >
                      <div className="provider-icon">
                        {getProviderIcon(p.icon)}
                      </div>
                      <span className="provider-name">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="filename">File Name</label>
                <input
                  id="filename"
                  className="form-input"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  disabled={status !== 'idle'}
                />
              </div>

              {status !== 'idle' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--accent-primary)' }}>
                  <LucideIcons.Loader2 size={16} className="animate-spin" />
                  <span>{status === 'connecting' ? 'Connecting to provider...' : 'Uploading file...'}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-actions">
          {status === 'success' ? (
            <button className="btn btn-primary" onClick={onClose}>Close</button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={onClose} disabled={status !== 'idle'}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={status !== 'idle' || !filename}
              >
                Save Now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};