import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import { serializeCanvasState, compressStateToHash, generateQrCodeUrl, getShareBaseUrl } from '../../utils/shareUtils';
import { collaborationService } from '../../services/collaboration/WebRTCCollaborationService';
import { initCollaborationSync } from '../../services/collaboration/collaborationSync';
import './Modals.css';
import './ServerlessShareModal.css';

export const ServerlessShareModal: React.FC = () => {
  const isOpen = useStore((s) => s.isServerlessShareDialogOpen);
  const initialTab = useStore((s) => s.serverlessShareTab || 'url');
  const setIsOpen = useStore((s) => s.setIsServerlessShareDialogOpen);
  const documentSize = useStore((s) => s.documentSize);
  const addAlert = useStore((s) => s.addAlert);

  const [activeTab, setActiveTab] = useState<'url' | 'webrtc' | 'public'>(initialTab);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [showQr, setShowQr] = useState<boolean>(false);

  // WebRTC state
  const [roomCode, setRoomCode] = useState<string>(collaborationService.getRoomCode());
  const [joinInput, setJoinInput] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(Boolean(collaborationService.getRoomCode()));
  const [peerCount, setPeerCount] = useState<number>(collaborationService.getConnectedPeerCount());
  const [userNameInput, setUserNameInput] = useState<string>(collaborationService.getUserName());
  const [canEdit, setCanEdit] = useState<boolean>(collaborationService.getCanEdit());

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      generateUrlLink();
      const currentRoom = collaborationService.getRoomCode();
      setRoomCode(currentRoom);
      setIsConnected(Boolean(currentRoom));
      setPeerCount(collaborationService.getConnectedPeerCount());
      setUserNameInput(collaborationService.getUserName());
      setCanEdit(collaborationService.getCanEdit());
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    initCollaborationSync();

    const updatePeerStatus = () => {
      setPeerCount(collaborationService.getConnectedPeerCount());
      setIsConnected(Boolean(collaborationService.getRoomCode()));
      setCanEdit(collaborationService.getCanEdit());
    };

    updatePeerStatus();

    // Listen to collaboration events
    const unsubscribe = collaborationService.subscribe((msg) => {
      updatePeerStatus();
      if (msg.type === 'JOIN') {
        addAlert({ type: 'info', message: `Peer ${msg.peerName || msg.peerId} joined co-editing session!` });
      }
    });

    const interval = setInterval(updatePeerStatus, 1000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [addAlert]);

  if (!isOpen) return null;

  const ensureCanvasExists = () => {
    if (useStore.getState().layers.length === 0) {
      useStore.getState().addLayer({
        name: 'Background Layer',
        type: 'paint',
        visible: true,
        opacity: 1,
      });
    }
  };

  const generateUrlLink = async () => {
    setIsGenerating(true);
    try {
      ensureCanvasExists();
      const currentLayers = useStore.getState().layers;
      const state = serializeCanvasState(currentLayers, documentSize);
      const compressed = await compressStateToHash(state);
      const fullUrl = `${getShareBaseUrl()}${window.location.pathname}#state=${compressed}`;
      setShareUrl(fullUrl);
    } catch (err: any) {
      addAlert({ type: 'error', message: 'Failed to encode canvas state into URL' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyUrl = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setIsCopied(true);
    addAlert({ type: 'success', message: 'Shareable canvas URL copied to clipboard!' });
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleCreateRoom = () => {
    ensureCanvasExists();
    const code = collaborationService.createRoom();
    setRoomCode(code);
    setIsConnected(true);
    setPeerCount(0);
    addAlert({ type: 'success', message: `Serverless P2P Room created! Room Code: ${code}` });
  };

  const handleCopyRoomCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    addAlert({ type: 'success', message: `Room Code "${roomCode}" copied to clipboard!` });
  };

  const handleCopyRoomLink = () => {
    if (!roomCode) return;
    const inviteLink = `${getShareBaseUrl()}${window.location.pathname}?room=${roomCode}`;
    navigator.clipboard.writeText(inviteLink);
    addAlert({ type: 'success', message: 'Direct P2P invite link copied to clipboard!' });
  };

  const handleJoinRoom = () => {
    let cleanCode = joinInput.trim();
    if (!cleanCode) return;

    if (cleanCode.includes('room=')) {
      const match = cleanCode.match(/[?&]room=([^&]+)/);
      if (match) cleanCode = match[1];
    }

    ensureCanvasExists();
    collaborationService.joinRoom(cleanCode);
    setRoomCode(cleanCode);
    setIsConnected(true);
    setPeerCount(collaborationService.getConnectedPeerCount());
    addAlert({ type: 'info', message: `Joined P2P Room: ${cleanCode}` });
  };

  const handleLeaveRoom = () => {
    collaborationService.leaveRoom();
    setIsConnected(false);
    setRoomCode('');
    setPeerCount(0);
    addAlert({ type: 'info', message: 'Left co-editing room session' });
  };

  const handleRequestEdit = () => {
    let name = userNameInput.trim();
    if (!name) {
      const input = prompt('Enter your Name to Request Edit Permission from Host:');
      if (!input || !input.trim()) {
        addAlert({ type: 'warning', message: 'Name is required to request Edit Permission.' });
        return;
      }
      name = input.trim();
      setUserNameInput(name);
      collaborationService.setUserName(name);
    } else {
      collaborationService.setUserName(name);
    }

    collaborationService.requestEditPermission(name);
    addAlert({ type: 'info', message: `Edit Request sent to Host as "${name}". Waiting for Host approval...` });
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Pixelite Canvas',
          text: 'Check out my canvas on Pixelite!',
          url: shareUrl || window.location.href,
        });
      } catch (err) {
        console.warn('Native share cancelled or failed', err);
      }
    } else {
      handleCopyUrl();
    }
  };

  return (
    <div className="modal-overlay" onClick={() => setIsOpen(false)}>
      <div className="modal-content serverless-share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LucideIcons.Share2 size={20} style={{ color: 'var(--accent-primary, #6366f1)' }} />
            <h3>Share Canvas (Serverless)</h3>
          </div>
          <button className="modal-close-btn" onClick={() => setIsOpen(false)}>
            <LucideIcons.X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="share-tabs">
          <button
            className={`share-tab-btn ${activeTab === 'url' ? 'active' : ''}`}
            onClick={() => setActiveTab('url')}
          >
            <LucideIcons.Link size={16} />
            <span>URL Link</span>
          </button>

          <button
            className={`share-tab-btn ${activeTab === 'webrtc' ? 'active' : ''}`}
            onClick={() => setActiveTab('webrtc')}
          >
            <LucideIcons.Users size={16} />
            <span>P2P Live (WebRTC)</span>
          </button>

          <button
            className={`share-tab-btn ${activeTab === 'public' ? 'active' : ''}`}
            onClick={() => setActiveTab('public')}
          >
            <LucideIcons.UploadCloud size={16} />
            <span>Public Host / OS Share</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="share-body">
          {activeTab === 'url' && (
            <>
              <div className="share-info-card">
                <LucideIcons.ShieldCheck size={20} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Zero-Server Compressed Link:</strong> Your canvas data (layers & metadata) is serialized into a compressed hash in the URL. Recipients can open it instantly without any backend database.
                </div>
              </div>

              {isGenerating ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '12px 0' }}>
                  <LucideIcons.Loader2 size={16} className="animate-spin" />
                  <span>Compressing canvas layers...</span>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>Shareable Canvas URL</label>
                    <div className="url-share-box">
                      <input className="url-input" value={shareUrl} readOnly />
                      <button className="btn btn-primary" onClick={handleCopyUrl}>
                        {isCopied ? <LucideIcons.Check size={16} /> : <LucideIcons.Copy size={16} />}
                        <span>{isCopied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ flex: 1, fontSize: '12px' }}
                      onClick={() => setShowQr(!showQr)}
                    >
                      <LucideIcons.QrCode size={16} />
                      <span>{showQr ? 'Hide QR Code' : 'Show QR Code'}</span>
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ flex: 1, fontSize: '12px' }}
                      onClick={handleNativeShare}
                    >
                      <LucideIcons.Share size={16} />
                      <span>Native OS Share</span>
                    </button>
                  </div>

                  {showQr && shareUrl && (
                    <div className="qr-section">
                      <img
                        className="qr-image"
                        src={generateQrCodeUrl(shareUrl, 160)}
                        alt="Canvas QR Code"
                        width={160}
                        height={160}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Scan with camera to open canvas on mobile
                      </span>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'webrtc' && (
            <>
              <div className="share-info-card">
                <LucideIcons.Wifi size={20} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Peer-to-Peer Live Collaboration:</strong> Connect directly with other browsers using WebRTC Data Channels. No canvas data passes through any central server.
                </div>
              </div>

              <div className="webrtc-room-box">
                {isConnected ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="room-status-badge status-active">
                        <LucideIcons.Radio size={14} className="animate-pulse" />
                        <span>Connected (Room Code: <strong>{roomCode}</strong>)</span>
                      </span>
                      <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={handleLeaveRoom}>
                        Disconnect
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', margin: '8px 0' }}>
                      <button className="btn btn-secondary" style={{ flex: 1, fontSize: '12px' }} onClick={handleCopyRoomCode}>
                        <LucideIcons.Copy size={14} />
                        <span>Copy Code</span>
                      </button>
                      <button className="btn btn-primary" style={{ flex: 1, fontSize: '12px' }} onClick={handleCopyRoomLink}>
                        <LucideIcons.Link size={14} />
                        <span>Copy Join Link</span>
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => setShowQr(!showQr)} title="Mobile QR Code">
                        <LucideIcons.QrCode size={14} />
                      </button>
                    </div>

                    {showQr && roomCode && (
                      <div className="qr-section" style={{ margin: '10px 0' }}>
                        <img
                          className="qr-image"
                          src={generateQrCodeUrl(`${getShareBaseUrl()}${window.location.pathname}?room=${roomCode}`, 160)}
                          alt="Mobile Join QR Code"
                          width={160}
                          height={160}
                        />
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Scan with mobile camera to join live room instantly
                        </span>
                      </div>
                    )}

                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Connected Peers: <strong>{peerCount}</strong>
                    </div>

                    <div className="peer-list">
                      <div className="peer-item">
                        <span>
                          You ({collaborationService.getIsHost() ? 'Host / Editor' : canEdit ? 'Guest / Editor' : 'Guest / View-Only'})
                        </span>
                        <span style={{ color: canEdit ? '#10b981' : '#f59e0b', fontSize: '11px', fontWeight: 500 }}>
                          ● {canEdit ? 'Can Edit' : 'View-Only'}
                        </span>
                      </div>
                    </div>

                    {!collaborationService.getIsHost() && !canEdit && (
                      <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                        <div style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '8px' }}>
                          <LucideIcons.Lock size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                          You are currently in View-Only mode. Request permission from Host to edit canvas.
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            className="url-input"
                            placeholder="Your Display Name (e.g. Alex)"
                            value={userNameInput}
                            onChange={(e) => setUserNameInput(e.target.value)}
                          />
                          <button className="btn btn-primary" style={{ fontSize: '12px', whiteSpace: 'nowrap' }} onClick={handleRequestEdit}>
                            Request Edit
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '14px' }}>Host a Co-Editing Session</h4>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Generate a unique P2P room code to invite collaborators.
                      </p>
                      <button className="btn btn-primary" style={{ marginTop: '10px' }} onClick={handleCreateRoom}>
                        <LucideIcons.Plus size={16} />
                        <span>Create Live Room</span>
                      </button>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '8px 0' }} />

                    <div>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '14px' }}>Join Existing Session</h4>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          className="url-input"
                          placeholder="Enter Room Code (e.g. px_9a1f2)"
                          value={joinInput}
                          onChange={(e) => setJoinInput(e.target.value)}
                        />
                        <button className="btn btn-secondary" onClick={handleJoinRoom}>
                          Join
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {activeTab === 'public' && (
            <>
              <div className="share-info-card">
                <LucideIcons.Globe size={20} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Public Image Hosting:</strong> Render your canvas image and upload it anonymously to public image services (Imgur, ImageBB) or trigger native OS sharing.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button className="btn btn-primary" onClick={handleNativeShare}>
                  <LucideIcons.Share size={18} />
                  <span>Share via Native Device Share Sheet</span>
                </button>

                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', margin: '4px 0' }}>
                  — OR —
                </p>

                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsOpen(false);
                    useStore.setState({ saveModal: { type: 'public', provider: 'imgur' } });
                  }}
                >
                  <LucideIcons.Image size={18} />
                  <span>Upload Canvas Image to Public Host (Imgur / ImageBB)</span>
                </button>
              </div>
            </>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setIsOpen(false)}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
