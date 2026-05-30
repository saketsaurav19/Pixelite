import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import * as LucideIcons from 'lucide-react';
import './Dialogs.css';

type AspectRatio = 'free' | '1:1' | '4:3' | '16:9';

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
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('free');
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

    // We want to capture exactly what is shown in the video element (which has object-fit: cover)
    // To do this, we need to calculate the crop.

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let targetRatio = 0;
    if (aspectRatio === '1:1') targetRatio = 1;
    else if (aspectRatio === '4:3') targetRatio = 4 / 3;
    else if (aspectRatio === '16:9') targetRatio = 16 / 9;

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const videoRatio = videoWidth / videoHeight;

    let cropWidth = videoWidth;
    let cropHeight = videoHeight;
    let cropX = 0;
    let cropY = 0;

    if (targetRatio > 0) {
      if (videoRatio > targetRatio) {
        // Video is wider than target
        cropWidth = videoHeight * targetRatio;
        cropX = (videoWidth - cropWidth) / 2;
      } else {
        // Video is taller than target
        cropHeight = videoWidth / targetRatio;
        cropY = (videoHeight - cropHeight) / 2;
      }
    }

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    ctx.drawImage(
      video,
      cropX, cropY, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight
    );

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
    backgroundColor: '#000',
    overflow: 'hidden',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '300px'
  };

  if (aspectRatio === '1:1') videoContainerStyle.aspectRatio = '1 / 1';
  else if (aspectRatio === '4:3') videoContainerStyle.aspectRatio = '4 / 3';
  else if (aspectRatio === '16:9') videoContainerStyle.aspectRatio = '16 / 9';

  return (
    <div className="dialog-overlay" onMouseDown={handleClose}>
      <div className="dialog camera-dialog" onMouseDown={(e) => e.stopPropagation()} style={{ width: '500px', maxWidth: '90vw' }}>
        <div className="dialog-header">
          <h3>Take Picture</h3>
          <button className="dialog-close" onClick={handleClose}>
            <LucideIcons.X size={18} />
          </button>
        </div>

        <div className="dialog-body" style={{ padding: '16px' }}>
          {error && <div className="error-message" style={{ color: 'red', marginBottom: '16px' }}>{error}</div>}

          {!capturedImage ? (
            <>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>Aspect Ratio</label>
                <select
                  className="dialog-input"
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                >
                  <option value="free">Free (Original)</option>
                  <option value="1:1">1:1 Square</option>
                  <option value="4:3">4:3 Standard</option>
                  <option value="16:9">16:9 Widescreen</option>
                </select>
              </div>

              <div style={videoContainerStyle}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: aspectRatio === 'free' ? 'contain' : 'cover',
                    position: aspectRatio === 'free' ? 'static' : 'absolute',
                    top: 0,
                    left: 0
                  }}
                />
              </div>
            </>
          ) : (
            <>
              <div style={{ ...videoContainerStyle, backgroundImage: `url(${capturedImage})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
              </div>

              <div className="form-group" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="createNewProject"
                  checked={createNewProject}
                  onChange={(e) => setCreateNewProject(e.target.checked)}
                />
                <label htmlFor="createNewProject" style={{ margin: 0 }}>Create New Project</label>
              </div>
            </>
          )}
        </div>

        <div className="dialog-footer">
          {!capturedImage ? (
            <>
              <button className="dialog-button secondary" onClick={handleClose}>Cancel</button>
              <button className="dialog-button primary" onClick={capturePhoto} disabled={!!error || !stream}>Capture</button>
            </>
          ) : (
            <>
              <button className="dialog-button secondary" onClick={retakePhoto}>Retake</button>
              <button className="dialog-button primary" onClick={handleConfirm}>Confirm</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
