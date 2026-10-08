import React from 'react';

interface QrCameraScannerProps {
  onClose: () => void;
}

export const QrCameraScanner: React.FC<QrCameraScannerProps> = ({ onClose }) => {
  return (
    <div style={{ padding: 20, color: '#fff', background: '#222' }}>
      <p>QR Camera Scanner — not available in this build.</p>
      <button onClick={onClose} style={{ marginTop: 10 }}>Close</button>
    </div>
  );
};
