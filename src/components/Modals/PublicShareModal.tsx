import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { generateQrCodeUrl } from '../../utils/shareUtils';
import { PUBLIC_HOST_SERVICES } from '../../utils/cloudServices';
import './Modals.css';

interface PublicShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  service?: string;
  onUpload: (service: string, customKeys?: { imgurKey?: string; imageBBKey?: string }) => Promise<{ url: string; service: string }>;
}

export const PublicShareModal: React.FC<PublicShareModalProps> = ({
  isOpen,
  onClose,
  service,
  onUpload,
}) => {
  const [selectedService, setSelectedService] = useState(service || PUBLIC_HOST_SERVICES[0].id);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success'>('idle');
  const [shareLink, setShareLink] = useState('');
  const [usedService, setUsedService] = useState('');
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  // Custom API Keys
  const [imgurKey, setImgurKey] = useState(localStorage.getItem('pixelite_imgur_key') || '');
  const [imageBBKey, setImageBBKey] = useState(localStorage.getItem('pixelite_imagebb_key') || '');
  const [showKeySettings, setShowKeySettings] = useState(false);

  if (!isOpen) return null;

  const handleUpload = async () => {
    setStatus('uploading');
    try {
      if (imgurKey) localStorage.setItem('pixelite_imgur_key', imgurKey.trim());
      if (imageBBKey) localStorage.setItem('pixelite_imagebb_key', imageBBKey.trim());

      const result = await onUpload(selectedService, { imgurKey, imageBBKey });
      setShareLink(result.url);
      setUsedService(result.service);
      setStatus('success');
    } catch (err: any) {
      setStatus('idle');
      alert(`Upload failed: ${err.message}`);
    }
  };

  const copyToClipboard = async (text: string, formatName: string) => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedFormat(formatName);
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch (e) {
      alert('Failed to copy to clipboard.');
    }
  };

  const getServiceIcon = (iconName: string) => {
    const Icon = (LucideIcons as any)[iconName] || LucideIcons.Image;
    return <Icon size={22} />;
  };

  const markdownLink = `![Pixelite Canvas](${shareLink})`;
  const htmlLink = `<img src="${shareLink}" alt="Pixelite Canvas" />`;
  const bbCodeLink = `[img]${shareLink}[/img]`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LucideIcons.CloudUpload size={20} style={{ color: 'var(--accent-primary, #6366f1)' }} />
            <h3>Share to Public Host</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <LucideIcons.X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {status === 'success' ? (
            <div className="success-state" style={{ textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <LucideIcons.CheckCircle2 size={28} style={{ color: '#10b981' }} />
                <div>
                  <h4 style={{ margin: 0, fontSize: '15px' }}>Upload Successful!</h4>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Hosted via <strong>{usedService.toUpperCase()}</strong>
                  </span>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600 }}>Direct Image Link (.png / .jpg)</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input className="url-input" value={shareLink} readOnly style={{ fontSize: '12px', flex: 1 }} />
                  <button className="btn btn-primary" onClick={() => copyToClipboard(shareLink, 'direct')}>
                    {copiedFormat === 'direct' ? <LucideIcons.Check size={14} /> : <LucideIcons.Copy size={14} />}
                    <span>{copiedFormat === 'direct' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Multi-Format Link Code Snippets */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <span>Markdown Embed</span>
                  <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => copyToClipboard(markdownLink, 'md')}>
                    {copiedFormat === 'md' ? 'Copied!' : 'Copy Markdown'}
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <span>HTML Embed Code</span>
                  <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => copyToClipboard(htmlLink, 'html')}>
                    {copiedFormat === 'html' ? 'Copied!' : 'Copy HTML'}
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <span>Forum BBCode</span>
                  <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => copyToClipboard(bbCodeLink, 'bb')}>
                    {copiedFormat === 'bb' ? 'Copied!' : 'Copy BBCode'}
                  </button>
                </div>
              </div>

              {/* QR Toggle */}
              <div style={{ marginTop: '12px' }}>
                <button className="btn btn-secondary" style={{ width: '100%', fontSize: '12px' }} onClick={() => setShowQr(!showQr)}>
                  <LucideIcons.QrCode size={14} />
                  <span>{showQr ? 'Hide Mobile QR Code' : 'Show Mobile QR Code'}</span>
                </button>

                {showQr && (
                  <div style={{ textAlign: 'center', marginTop: '10px' }}>
                    <img src={generateQrCodeUrl(shareLink, 140)} alt="QR Code" width={140} height={140} style={{ borderRadius: '8px', border: '1px solid var(--border-color)' }} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Select Public Host Provider</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
                  {PUBLIC_HOST_SERVICES.map((s) => (
                    <div
                      key={s.id}
                      className={`provider-card ${selectedService === s.id ? 'selected' : ''}`}
                      onClick={() => status === 'idle' && setSelectedService(s.id)}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        border: selectedService === s.id ? '2px solid var(--accent-primary, #6366f1)' : '1px solid var(--border-color, #334155)',
                        background: selectedService === s.id ? 'rgba(99, 102, 241, 0.1)' : 'var(--card-bg, #1e293b)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {getServiceIcon(s.icon)}
                        <div>
                          <span style={{ fontSize: '13px', fontWeight: 600, display: 'block' }}>{s.name}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{s.badge}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom API Key Collapsible */}
              <div style={{ margin: '10px 0' }}>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--accent-primary, #38bdf8)', fontSize: '11px', cursor: 'pointer', padding: 0 }}
                  onClick={() => setShowKeySettings(!showKeySettings)}
                >
                  {showKeySettings ? '▲ Hide Custom API Key Settings' : '▼ Optional: Custom Provider API Keys'}
                </button>

                {showKeySettings && (
                  <div style={{ marginTop: '8px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', fontSize: '11px' }}>
                    <div style={{ marginBottom: '6px' }}>
                      <label style={{ display: 'block', marginBottom: '2px' }}>Imgur Client ID (Optional):</label>
                      <input className="url-input" value={imgurKey} onChange={(e) => setImgurKey(e.target.value)} placeholder="e.g. e9f4a138c21a415" style={{ fontSize: '11px' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '2px' }}>ImageBB API Key (Optional):</label>
                      <input className="url-input" value={imageBBKey} onChange={(e) => setImageBBKey(e.target.value)} placeholder="e.g. 646b97645f782c5a278149f127419163" style={{ fontSize: '11px' }} />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ padding: '10px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                <p style={{ fontSize: '11px', color: '#38bdf8', margin: 0 }}>
                  <LucideIcons.ShieldCheck size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  Auto-Fallback Enabled: If primary upload fails or rate-limits, Pixelite will automatically fallback to secondary free hosts.
                </p>
              </div>

              {status === 'uploading' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--accent-primary)', marginTop: '12px' }}>
                  <LucideIcons.Loader2 size={16} className="animate-spin" />
                  <span>Uploading canvas to public host...</span>
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
              <button className="btn btn-primary" onClick={handleUpload} disabled={status !== 'idle'}>
                Upload & Get Link
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
