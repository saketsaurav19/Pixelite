import React, { useEffect, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { collaborationService, type PeerMessage } from '../../services/collaboration/WebRTCCollaborationService';
import { useStore } from '../../store/useStore';
import './CollabPermissionPopup.css';

interface PendingRequest {
  peerId: string;
  peerName: string;
}

export const CollabPermissionPopup: React.FC = () => {
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(5);
  const addAlert = useStore((s) => s.addAlert);

  useEffect(() => {
    // Listen for PERMISSION_REQUEST messages on Host
    const unsubscribe = collaborationService.subscribe((msg: PeerMessage) => {
      if (msg.type === 'PERMISSION_REQUEST' && collaborationService.getIsHost()) {
        setPendingRequest({
          peerId: msg.peerId,
          peerName: msg.peerName || 'Collaborator',
        });
        setTimeLeft(5);
      }
    });

    return () => unsubscribe();
  }, []);

  // 5-second countdown timer for auto-rejection
  useEffect(() => {
    if (!pendingRequest) return;

    if (timeLeft <= 0) {
      handleReject();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [pendingRequest, timeLeft]);

  if (!pendingRequest) return null;

  const handleAccept = () => {
    if (pendingRequest) {
      collaborationService.respondToPermissionRequest(pendingRequest.peerId, true);
      addAlert({
        type: 'success',
        message: `Granted Edit Permission to "${pendingRequest.peerName}".`,
      });
      setPendingRequest(null);
    }
  };

  const handleReject = () => {
    if (pendingRequest) {
      collaborationService.respondToPermissionRequest(pendingRequest.peerId, false);
      addAlert({
        type: 'warning',
        message: `Rejected Edit Request from "${pendingRequest.peerName}".`,
      });
      setPendingRequest(null);
    }
  };

  return (
    <div className="collab-permission-popup">
      <div className="collab-popup-header">
        <div className="collab-popup-title">
          <LucideIcons.ShieldAlert className="collab-icon-pulse" size={18} />
          <span>Edit Permission Request</span>
        </div>
        <span className="collab-timer-badge">{timeLeft}s</span>
      </div>

      <div className="collab-popup-body">
        <strong>{pendingRequest.peerName}</strong> wants to edit the canvas.
      </div>

      <div className="collab-timer-progress">
        <div
          className="collab-timer-bar"
          style={{ width: `${(timeLeft / 5) * 100}%` }}
        />
      </div>

      <div className="collab-popup-actions">
        <button className="collab-btn collab-btn-reject" onClick={handleReject}>
          <LucideIcons.X size={14} />
          <span>Reject</span>
        </button>
        <button className="collab-btn collab-btn-accept" onClick={handleAccept}>
          <LucideIcons.Check size={14} />
          <span>Accept ({timeLeft}s)</span>
        </button>
      </div>
    </div>
  );
};
