import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import * as LucideIcons from 'lucide-react';
import './Dialogs.css';

export const CameraDialog: React.FC = () => {
  const {
    isCameraDialogOpen,
    setIsCameraDialogOpen,
    layers,
    setLayers,
    documentSize,
    setDocumentSize,
    recordHistory
  } = useStore();

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [createNewProject, setCreateNewProject] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Could not access camera. Please check permissions.');
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    if (isCameraDialogOpen) {
      setTimeout(() => {
        if (mounted) {
          setCapturedImage(null);
          setCreateNewProject(false);
        }
      }, 0);
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(mediaStream => {
          if (mounted) {
            setStream(mediaStream);
            if (videoRef.current) {
              videoRef.current.srcObject = mediaStream;
            }
          } else {
             mediaStream.getTracks().forEach(track => track.stop());
          }
        })
        .catch(err => {
          if (mounted) {
            console.error('Error accessing camera:', err);
            setError('Could not access camera. Please check permissions.');
          }
        });
    } else {
      setTimeout(() => {
        setStream((prevStream) => {
          if (prevStream) {
            prevStream.getTracks().forEach(track => track.stop());
          }
          return null;
        });
      }, 0);
    }
    return () => {
      mounted = false;
      setStream((prevStream) => {
        if (prevStream) {
          prevStream.getTracks().forEach(track => track.stop());
        }
        return null;
      });
    };
  }, [isCameraDialogOpen]);

  if (!isCameraDialogOpen) return null;

  const handleClose = () => {
    setIsCameraDialogOpen(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/png');
    setCapturedImage(dataUrl);
    stopStream();
  };

  const handleConfirm = () => {
    if (!capturedImage) return;

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
          dataUrl: capturedImage,
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
          dataUrl: capturedImage,
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
      recordHistory('Take Picture');
      handleClose();
    };
    img.src = capturedImage;
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const videoContainerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '400px',
    borderRadius: '4px',
    border: '1px solid #333'
  };

  return (
    <div className="dialog-overlay" onMouseDown={handleClose}>
      <div className="dialog-content camera-dialog" onMouseDown={(e) => e.stopPropagation()} style={{ width: '600px', maxWidth: '90vw' }}>
        <div className="dialog-header">
          <h2>Take Picture</h2>
          <button className="dialog-close" onClick={handleClose}>
            <LucideIcons.X size={18} />
          </button>
        </div>

        <div className="dialog-body" style={{ padding: '20px' }}>
          {error && <div className="error-message" style={{ color: 'red' }}>{error}</div>}

          {!capturedImage ? (
            <div style={videoContainerStyle}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain'
                }}
              />
            </div>
          ) : (
            <div style={{ ...videoContainerStyle, backgroundImage: `url(${capturedImage})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
            </div>
          )}
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
            {!capturedImage ? (
              <>
                <button className="btn-secondary" onClick={handleClose}>Cancel</button>
                <button className="btn-primary" onClick={capturePhoto} disabled={!!error || !stream}>Capture</button>
              </>
            ) : (
              <>
                <button className="btn-secondary" onClick={retakePhoto}>Retake</button>
                <button className="btn-primary" onClick={handleConfirm}>Confirm</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
