import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import './Modals.css';

interface PublicShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  service?: string;
  onUpload: (service: string) => Promise<string>; // Returns the share link
}

const SERVICES = [
  { id: 'imgur', name: 'Imgur', icon: 'Image' },
  { id: 'imagebb', name: 'ImageBB', icon: 'Share2' },
  { id: 'postimages', name: 'PostImages', icon: 'ExternalLink' },
];

export const PublicShareModal: React.FC<PublicShareModalProps> = ({
  isOpen,
  onClose,
  service,
  onUpload
}) => {
  const [selectedService, setSelectedService] = useState(service || SERVICES[0].id);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success'>('idle');
  const [shareLink, setShareLink] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  const handleUpload = async () => {
    setStatus('uploading');
    try {
      const link = await onUpload(selectedService);
      setShareLink(link);
      setStatus('success');
    } catch (err: any) {
      setStatus('idle');
      alert(`Upload failed: ${err.message}`);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const getServiceIcon = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName] || LucideIcons.Image;
    return <Icon size={24} />;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Share to Public</h3>
          <button className="modal-close-btn" onClick={onClose}>
            <LucideIcons.X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {status === 'success' ? (
            <div className="success-state">
              <div className="success-icon">
                <LucideIcons.Share size={40} />
              </div>
              <h4>Upload Complete!</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Your image is now public. Use the link below to share it.
              </p>

              <div className="success-link-box">
                <input className="success-link" value={shareLink} readOnly />
                <button className="copy-btn" onClick={handleCopy}>
                  {isCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>Select Service</label>
                <div className="provider-grid">
                  {SERVICES.map((s) => (
                    <div
                      key={s.id}
                      className={`provider-card ${selectedService === s.id ? 'selected' : ''}`}
                      onClick={() => status === 'idle' && setSelectedService(s.id)}
                    >
                      <div className="provider-icon">
                        {getServiceIcon(s.icon)}
                      </div>
                      <span className="provider-name">{s.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: '12px', background: 'rgba(255, 193, 7, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 193, 7, 0.2)' }}>
                <p style={{ fontSize: '11px', color: '#ffc107', margin: 0 }}>
                  <LucideIcons.AlertTriangle size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  Note: Images uploaded to public services are accessible to anyone with the link.
                </p>
              </div>

              {status === 'uploading' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--accent-primary)' }}>
                  <LucideIcons.Loader2 size={16} className="animate-spin" />
                  <span>Uploading to {SERVICES.find(s => s.id === selectedService)?.name}...</span>
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
                onClick={handleUpload}
                disabled={status !== 'idle'}
              >
                Upload & Share
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
