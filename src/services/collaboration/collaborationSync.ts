import { useStore } from '../../store/useStore';
import { collaborationService, type PeerMessage } from './WebRTCCollaborationService';
import { serializeCanvasState } from '../../utils/shareUtils';

let isApplyingRemoteUpdate = false;
let isInitialized = false;

/**
 * Prompt helper to request edit permission for guest viewers.
 */
export function promptForEditPermission(): boolean {
  if (collaborationService.getCanEdit()) return true;

  let name = collaborationService.getUserName();
  if (!name) {
    const input = prompt('View-Only Mode: Enter your Name to request Edit Permission from the Host:');
    if (!input || !input.trim()) {
      useStore.getState().addAlert({
        type: 'warning',
        message: 'Name is required to request Edit Permission from Host.',
      });
      return false;
    }
    name = input.trim();
    collaborationService.setUserName(name);
  }

  collaborationService.requestEditPermission(name);
  useStore.getState().addAlert({
    type: 'info',
    message: `Edit Request sent to Host as "${name}". Waiting for Host approval...`,
  });
  return false;
}

/**
 * Initializes automatic store synchronization for live peer-to-peer collaboration with View-Only permissions.
 */
export function initCollaborationSync() {
  if (isInitialized) return;
  isInitialized = true;

  console.log('[Pixelite P2P Sync] ⚙️ Initializing Store Collaboration Sync engine with Role Permissions...');

  // Auto-detect ?room=px_xxxx query parameter in URL on page load for immediate P2P connection
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam && !collaborationService.getRoomCode()) {
      const cleanRoom = roomParam.trim().toLowerCase();
      console.log(`[Pixelite P2P Sync] 🔗 Auto-joining room from URL query parameter: "${cleanRoom}"`);
      collaborationService.joinRoom(cleanRoom);
      useStore.getState().addAlert({
        type: 'info',
        message: `Auto-connecting to shared P2P session: ${cleanRoom}...`,
      });
    }
  } catch (err) {
    // Ignore URL parse errors
  }

  // Listen for incoming peer messages
  collaborationService.subscribe((msg: PeerMessage) => {
    const addAlert = useStore.getState().addAlert;

    if (msg.type === 'JOIN') {
      // If we are host and someone joins, send full state snapshot
      if (collaborationService.getIsHost()) {
        const { layers, documentSize } = useStore.getState();
        const serialized = serializeCanvasState(layers, documentSize);
        console.log(`[Pixelite P2P Sync] 📤 Host sending full canvas snapshot (${layers.length} layers) to joining peer: ${msg.peerId}`);
        collaborationService.broadcast({
          type: 'STATE_UPDATE',
          peerId: collaborationService.getPeerId(),
          timestamp: Date.now(),
          payload: { layers: serialized.layers, documentSize: serialized.documentSize },
        });
      }
    } else if (msg.type === 'PERMISSION_REQUEST') {
      // Handled by top-right CollabPermissionPopup component
    } else if (msg.type === 'PERMISSION_RESPONSE' && msg.payload) {
      const { targetPeerId, granted } = msg.payload;
      if (targetPeerId === collaborationService.getPeerId()) {
        if (granted) {
          addAlert({ type: 'success', message: '🎉 Host granted you Edit Permission! You can now edit the canvas.' });
        } else {
          addAlert({ type: 'error', message: '❌ Host rejected your Edit Permission request.' });
        }
      }
    } else if (msg.type === 'STATE_UPDATE' && msg.payload) {
      const { layers, documentSize } = msg.payload;
      if (layers && Array.isArray(layers)) {
        console.log(`[Pixelite P2P Sync] 📥 Applying remote STATE_UPDATE from peer ${msg.peerId} (${layers.length} layers)`);
        isApplyingRemoteUpdate = true;
        try {
          useStore.setState((state) => {
            const hasValidActive = layers.some((l: any) => l.id === state.activeLayerId);
            const targetActive = hasValidActive ? state.activeLayerId : (layers[0]?.id || null);
            return {
              ...state,
              layers,
              activeLayerId: targetActive,
              ...(documentSize ? { documentSize } : {}),
            };
          });
        } catch (err) {
          console.error('[Pixelite P2P Sync] ❌ Failed to apply remote state update:', err);
        } finally {
          setTimeout(() => {
            isApplyingRemoteUpdate = false;
          }, 50);
        }
      }
    }
  });

  // Subscribe to local store changes and broadcast sanitized layer states to peers
  let prevLayersHash = '';

  useStore.subscribe((state) => {
    const roomCode = collaborationService.getRoomCode();
    if (!roomCode || isApplyingRemoteUpdate) return;

    // Check if local user has edit permissions
    if (!collaborationService.getCanEdit()) {
      return;
    }

    try {
      const serialized = serializeCanvasState(state.layers, state.documentSize);
      const currentLayersHash = JSON.stringify(serialized.layers);

      if (currentLayersHash !== prevLayersHash) {
        prevLayersHash = currentLayersHash;
        console.log(`[Pixelite P2P Sync] 🎨 Local layer change detected! Broadcasting state update (${state.layers.length} layers)...`);

        collaborationService.broadcast({
          type: 'STATE_UPDATE',
          peerId: collaborationService.getPeerId(),
          timestamp: Date.now(),
          payload: {
            layers: serialized.layers,
            documentSize: serialized.documentSize,
          },
        });
      }
    } catch (err) {
      console.warn('[Pixelite P2P Sync] ⚠️ Error serializing local layer update:', err);
    }
  });
}
