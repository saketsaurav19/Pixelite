import Peer, { type DataConnection } from 'peerjs';
import { useStore } from '../../store/useStore';
import { serializeCanvasState } from '../../utils/shareUtils';

export interface PeerMessage {
  type:
  | 'JOIN'
  | 'STATE_UPDATE'
  | 'CURSOR_MOVE'
  | 'STROKE_START'
  | 'STROKE_DRAW'
  | 'LEAVE'
  | 'PING'
  | 'PONG'
  | 'PERMISSION_REQUEST'
  | 'PERMISSION_RESPONSE'
  | 'P2P_SIGNAL';
  peerId: string;
  peerName?: string;
  payload?: any;
  timestamp: number;
  nonce?: string;
}

export type CollaborationEventListener = (message: PeerMessage) => void;

export interface SignalPayload {
  type: 'offer' | 'answer' | 'candidate';
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

class WebRTCCollaborationService {
  private peerjs: Peer | null = null;
  private channel: BroadcastChannel | null = null;
  private peerjsConnections: Map<string, DataConnection> = new Map();
  private peerIdToConnMap: Map<string, DataConnection> = new Map();
  private peerId: string = '';
  private roomCode: string = '';
  private isHost: boolean = false;
  private userName: string = '';
  private canEdit: boolean = false;
  private connectedPeers: Set<string> = new Set();
  private listeners: Set<CollaborationEventListener> = new Set();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private storageListener: ((e: StorageEvent) => void) | null = null;
  private recentMessages: Set<string> = new Set();

  constructor() {
    this.peerId = 'peer_' + Math.random().toString(36).substring(2, 8);
    this.userName = localStorage.getItem('pixelite_p2p_username') || '';
    console.log('[Pixelite P2P] WebRTC Collaboration Service initialized. Local Peer ID:', this.peerId);
    this.initStorageListener();
  }

  public getPeerId(): string {
    return this.peerId;
  }

  public getRoomCode(): string {
    return this.roomCode;
  }

  public getIsHost(): boolean {
    return this.isHost;
  }

  public getUserName(): string {
    return this.userName;
  }

  public setUserName(name: string): void {
    this.userName = name.trim();
    if (this.userName) {
      localStorage.setItem('pixelite_p2p_username', this.userName);
    }
  }

  public getCanEdit(): boolean {
    return this.isHost || this.canEdit;
  }

  public setCanEdit(allow: boolean): void {
    this.canEdit = allow;
  }

  public getConnectedPeerCount(): number {
    return this.connectedPeers.size;
  }

  private getIceServers(): RTCIceServer[] {
    return [
      // Primary Google STUN cluster
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      // Secondary Public STUN providers
      { urls: 'stun:stun.services.mozilla.com' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.nextcloud.com:443' },
      // OpenRelay TURN servers (UDP, TCP, and TLS for NAT & mobile network traversal)
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelay', credential: 'openrelay' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelay', credential: 'openrelay' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelay', credential: 'openrelay' },
      { urls: 'turns:openrelay.metered.ca:443?transport=tcp', username: 'openrelay', credential: 'openrelay' },
      { urls: 'turns:openrelay.metered.ca:443', username: 'openrelay', credential: 'openrelay' },
    ];
  }

  /**
   * Starts a new serverless room session as Host.
   */
  public createRoom(roomName?: string): string {
    this.leaveRoom();
    this.roomCode = (roomName || 'px_' + Math.random().toString(36).substring(2, 7)).toLowerCase();
    this.isHost = true;
    this.canEdit = true;
    console.log(`[Pixelite P2P] 🚀 Hosting Room "${this.roomCode}" as Host (Peer ID: ${this.peerId})`);

    this.initChannel();
    this.initPeerJSHost();
    this.startHeartbeat();
    return this.roomCode;
  }

  /**
   * Joins an existing room session as Guest.
   */
  public joinRoom(code: string): void {
    const cleanCode = code.toLowerCase().trim();
    if (!cleanCode) return;

    this.leaveRoom();
    this.roomCode = cleanCode;
    this.isHost = false;
    this.canEdit = false;
    console.log(`[Pixelite P2P] 🔗 Joining Room "${this.roomCode}" as Guest (Peer ID: ${this.peerId})`);

    this.initChannel();
    this.initPeerJSGuest();
    this.startHeartbeat();
  }

  /**
   * Sends an Edit Permission Request to the Host.
   */
  public requestEditPermission(name?: string): void {
    if (name) {
      this.setUserName(name);
    }
    console.log(`[Pixelite P2P] 🙋 Requesting Edit Permission as "${this.userName || this.peerId}"...`);
    this.broadcast({
      type: 'PERMISSION_REQUEST',
      peerId: this.peerId,
      peerName: this.userName || 'Collaborator',
      timestamp: Date.now(),
    });
  }

  /**
   * Responds to a Peer's Edit Permission Request (Host action).
   */
  public respondToPermissionRequest(targetPeerId: string, granted: boolean): void {
    console.log(`[Pixelite P2P] 👑 Host responded to Edit Request for ${targetPeerId}: ${granted ? 'GRANTED' : 'REJECTED'}`);
    this.broadcast({
      type: 'PERMISSION_RESPONSE',
      peerId: this.peerId,
      payload: { targetPeerId, granted },
      timestamp: Date.now(),
    });
  }

  /**
   * Disconnects from current room session and cleans up resources.
   */
  public leaveRoom(): void {
    if (this.roomCode) {
      console.log(`[Pixelite P2P] 🚪 Disconnecting from room "${this.roomCode}"`);
    }

    this.stopHeartbeat();

    if (this.channel) {
      try {
        this.broadcast({
          type: 'LEAVE',
          peerId: this.peerId,
          timestamp: Date.now(),
        });
      } catch (e) {
        // Ignore
      }
      this.channel.close();
      this.channel = null;
    }

    this.peerjsConnections.forEach((conn) => {
      try {
        conn.close();
      } catch (e) {
        // Ignore
      }
    });
    this.peerjsConnections.clear();
    this.peerIdToConnMap.clear();

    if (this.peerjs) {
      try {
        this.peerjs.destroy();
      } catch (e) {
        // Ignore
      }
      this.peerjs = null;
    }

    this.connectedPeers.clear();
    this.recentMessages.clear();
    this.roomCode = '';
    this.isHost = false;
    this.canEdit = false;
  }

  /**
   * Broadcasts a message across WebRTC DataChannels, BroadcastChannel & LocalStorage.
   */
  public broadcast(msg: PeerMessage): void {
    if (!msg.nonce) {
      msg.nonce = Math.random().toString(36).substring(2, 9);
    }

    // 1. PeerJS WebRTC DataChannels
    this.peerjsConnections.forEach((conn, key) => {
      if (conn && conn.open) {
        try {
          conn.send(msg);
        } catch (err) {
          console.warn(`[Pixelite P2P] Failed to send over PeerJS connection ${key}:`, err);
        }
      }
    });

    // 2. BroadcastChannel (Same-origin tabs)
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch (err) {
        // Ignore
      }
    }

    // 3. LocalStorage Event Bus (Same-origin windows)
    if (this.roomCode) {
      try {
        const busEvent = JSON.stringify({
          roomCode: this.roomCode,
          msg,
          nonce: msg.nonce,
        });
        localStorage.setItem('pixelite_p2p_bus', busEvent);
      } catch (e) {
        // Ignore quota limits
      }
    }
  }

  public sendToPeer(targetPeerId: string, msg: PeerMessage): void {
    if (!msg.nonce) {
      msg.nonce = Math.random().toString(36).substring(2, 9);
    }
    const conn = this.peerIdToConnMap.get(targetPeerId) || this.peerjsConnections.get(targetPeerId);
    if (conn && conn.open) {
      try {
        conn.send(msg);
        return;
      } catch (e) {
        console.warn(`[Pixelite P2P] Direct send to peer ${targetPeerId} failed:`, e);
      }
    }
    // Fallback to broadcast
    this.broadcast(msg);
  }

  public subscribe(listener: CollaborationEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private sendStateSnapshotToConn(conn: DataConnection): void {
    if (!this.isHost || !conn.open) return;
    try {
      const { layers, documentSize } = useStore.getState();
      const serialized = serializeCanvasState(layers, documentSize);
      console.log(`[Pixelite P2P] 📤 Host sending full state snapshot (${layers.length} layers) to peer "${conn.peer}"`);
      conn.send({
        type: 'STATE_UPDATE',
        peerId: this.peerId,
        timestamp: Date.now(),
        payload: { layers: serialized.layers, documentSize: serialized.documentSize },
      });
    } catch (err) {
      console.error('[Pixelite P2P] ❌ Failed to send state snapshot:', err);
    }
  }

  private initPeerJSHost(): void {
    try {
      console.log(`[Pixelite P2P] 🛠️ Initializing Host signaling with room code "${this.roomCode}"...`);
      this.peerjs = new Peer(this.roomCode, {
        config: {
          iceServers: this.getIceServers(),
          iceCandidatePoolSize: 10,
        },
        debug: 1,
      });

      this.peerjs.on('open', (id) => {
        console.log(`[Pixelite P2P] ✅ Host signaling ready! Assigned Room ID: "${id}"`);
      });

      this.peerjs.on('disconnected', () => {
        console.warn('[Pixelite P2P] ⚠️ Host signaling server connection lost. Auto-reconnecting...');
        try {
          this.peerjs?.reconnect();
        } catch (e) {
          // Ignore
        }
      });

      this.peerjs.on('connection', (conn: DataConnection) => {
        console.log(`[Pixelite P2P] 📥 Incoming WebRTC connection from remote peer: "${conn.peer}"`);

        const handleOpen = () => {
          console.log(`[Pixelite P2P] 🤝 WebRTC DataChannel OPENED with peer "${conn.peer}"`);
          this.peerjsConnections.set(conn.peer, conn);
          this.sendStateSnapshotToConn(conn);
        };

        if (conn.open) {
          handleOpen();
        } else {
          conn.on('open', handleOpen);
        }

        conn.on('data', (data: any) => {
          if (data && typeof data === 'object') {
            this.peerjsConnections.set(conn.peer, conn);
            if (data.peerId) {
              this.peerIdToConnMap.set(data.peerId, conn);
            }
            this.handleIncomingMessage(data as PeerMessage, conn);
          }
        });

        conn.on('close', () => {
          console.log(`[Pixelite P2P] 🔌 WebRTC connection closed with peer "${conn.peer}"`);
          this.peerjsConnections.delete(conn.peer);
          if (conn.peer) {
            this.connectedPeers.delete(conn.peer);
          }
        });

        conn.on('error', (err) => {
          console.error(`[Pixelite P2P] ❌ WebRTC connection error with peer "${conn.peer}":`, err);
        });
      });

      this.peerjs.on('error', (err) => {
        console.error('[Pixelite P2P] ❌ Signaling Host Error:', err.type, err.message);
        if (err.type === 'unavailable-id') {
          const newCode = 'px_' + Math.random().toString(36).substring(2, 7);
          console.log(`[Pixelite P2P] 🔄 Room code "${this.roomCode}" was taken. Generating new code "${newCode}"...`);
          this.roomCode = newCode;
          this.initPeerJSHost();
        }
      });
    } catch (err) {
      console.error('[Pixelite P2P] ❌ Failed to initialize signaling Host:', err);
    }
  }

  private initPeerJSGuest(): void {
    try {
      console.log(`[Pixelite P2P] 🛠️ Initializing Guest signaling to connect to Host room "${this.roomCode}"...`);
      // Let PeerJS generate a unique signaling broker ID automatically
      this.peerjs = new Peer({
        config: {
          iceServers: this.getIceServers(),
          iceCandidatePoolSize: 10,
        },
        debug: 1,
      });

      const connectToHost = () => {
        if (!this.peerjs || this.peerjs.destroyed) return;

        console.log(`[Pixelite P2P] 🤝 Guest connecting WebRTC DataChannel to Host Room "${this.roomCode}"...`);
        const conn = this.peerjs.connect(this.roomCode, { reliable: true });
        this.peerjsConnections.set(this.roomCode, conn);

        const sendJoin = () => {
          conn.send({
            type: 'JOIN',
            peerId: this.peerId,
            peerName: this.userName,
            timestamp: Date.now(),
          });
        };

        conn.on('open', () => {
          console.log(`[Pixelite P2P] 🎉 WebRTC P2P DataChannel OPENED with Host "${this.roomCode}"!`);
          this.connectedPeers.add(this.roomCode);

          // Send JOIN payload immediately and retry 1.2s later to guarantee snapshot delivery across high-latency mobile networks
          sendJoin();
          setTimeout(() => {
            if (conn.open) sendJoin();
          }, 1200);
        });

        conn.on('data', (data: any) => {
          if (data && typeof data === 'object') {
            this.handleIncomingMessage(data as PeerMessage, conn);
          }
        });

        conn.on('close', () => {
          console.log(`[Pixelite P2P] 🔌 WebRTC Connection to Host "${this.roomCode}" closed.`);
          this.peerjsConnections.delete(this.roomCode);
          this.connectedPeers.delete(this.roomCode);
        });

        conn.on('error', (err) => {
          console.error('[Pixelite P2P] ❌ WebRTC Guest DataChannel error:', err);
        });
      };

      this.peerjs.on('open', (id) => {
        console.log(`[Pixelite P2P] ✅ Guest signaling ready (${id}). Connecting to Host...`);
        connectToHost();
      });

      this.peerjs.on('disconnected', () => {
        console.warn('[Pixelite P2P] ⚠️ Guest signaling server connection lost. Auto-reconnecting...');
        try {
          this.peerjs?.reconnect();
        } catch (e) {
          // Ignore
        }
      });

      let guestRetryCount = 0;
      this.peerjs.on('error', (err) => {
        console.error('[Pixelite P2P] ❌ Signaling Guest Error:', err.type, err.message);
        if (err.type === 'peer-unavailable' && guestRetryCount < 6) {
          guestRetryCount++;
          console.log(`[Pixelite P2P] 🔄 Host room "${this.roomCode}" not found on signaling server yet. Retrying (${guestRetryCount}/6)...`);
          setTimeout(() => {
            connectToHost();
          }, 1500);
        } else if (err.type === 'peer-unavailable') {
          useStore.getState().addAlert({
            type: 'error',
            message: `P2P Room "${this.roomCode}" not found or Host is offline. Check Room Code.`,
          });
        }
      });
    } catch (err) {
      console.error('[Pixelite P2P] ❌ Failed to initialize signaling Guest:', err);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.roomCode) {
        this.broadcast({
          type: 'PING',
          peerId: this.peerId,
          timestamp: Date.now(),
        });
      }
    }, 3000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private initChannel(): void {
    if (this.channel) {
      this.channel.close();
    }

    const channelName = `pixelite_collab_${this.roomCode}`;
    this.channel = new BroadcastChannel(channelName);

    this.channel.onmessage = (event: MessageEvent<PeerMessage>) => {
      const msg = event.data;
      if (!msg || msg.peerId === this.peerId) return;

      this.handleIncomingMessage(msg);
    };
  }

  private initStorageListener(): void {
    if (typeof window === 'undefined' || this.storageListener) return;

    this.storageListener = (e: StorageEvent) => {
      if (e.key === 'pixelite_p2p_bus' && e.newValue) {
        try {
          const busData = JSON.parse(e.newValue);
          if (
            busData &&
            busData.roomCode === this.roomCode &&
            busData.msg &&
            busData.msg.peerId !== this.peerId
          ) {
            this.handleIncomingMessage(busData.msg);
          }
        } catch (err) {
          // Ignore
        }
      }
    };

    window.addEventListener('storage', this.storageListener);
  }

  public handleIncomingMessage(msg: PeerMessage, sourceConn?: DataConnection): void {
    if (msg.peerId === this.peerId) return;

    // Deduplicate messages across transports (PeerJS + BroadcastChannel + LocalStorage)
    const msgKey = msg.nonce
      ? `${msg.peerId}_${msg.nonce}`
      : `${msg.peerId}_${msg.type}_${msg.timestamp}`;

    if (this.recentMessages.has(msgKey)) {
      return;
    }
    this.recentMessages.add(msgKey);
    if (this.recentMessages.size > 200) {
      const firstKey = this.recentMessages.values().next().value;
      if (firstKey) this.recentMessages.delete(firstKey);
    }

    if (sourceConn && msg.peerId) {
      this.peerIdToConnMap.set(msg.peerId, sourceConn);
    }

    if (msg.type !== 'PING' && msg.type !== 'PONG' && msg.type !== 'P2P_SIGNAL') {
      console.log(`[Pixelite P2P] 📥 Received message [${msg.type}] from peer: ${msg.peerId}`);
    }

    if (msg.type === 'PERMISSION_RESPONSE' && msg.payload) {
      const { targetPeerId, granted } = msg.payload;
      if (targetPeerId === this.peerId) {
        this.setCanEdit(granted);
        console.log(`[Pixelite P2P] 🔒 Permission Response received for you: ${granted ? 'GRANTED' : 'REJECTED'}`);
      }
    }

    if (msg.type === 'JOIN') {
      const isNew = !this.connectedPeers.has(msg.peerId);
      this.connectedPeers.add(msg.peerId);
      if (isNew) {
        console.log(`[Pixelite P2P] ✅ Peer ${msg.peerId} joined room "${this.roomCode}"!`);
      }

      // If Host received JOIN from guest, ensure full state snapshot is sent back
      if (this.isHost && sourceConn) {
        this.sendStateSnapshotToConn(sourceConn);
      }

      this.broadcast({
        type: 'PONG',
        peerId: this.peerId,
        timestamp: Date.now(),
      });
    } else if (msg.type === 'PING') {
      this.connectedPeers.add(msg.peerId);
    } else if (msg.type === 'PONG') {
      this.connectedPeers.add(msg.peerId);
    } else if (msg.type === 'LEAVE') {
      this.connectedPeers.delete(msg.peerId);
      if (msg.peerId) {
        this.peerIdToConnMap.delete(msg.peerId);
      }
    } else if (msg.type === 'STATE_UPDATE') {
      this.connectedPeers.add(msg.peerId);

      // Host relays state update from an authorized guest to all other connected guests
      if (this.isHost) {
        this.peerjsConnections.forEach((conn, key) => {
          if (conn && conn.open && conn !== sourceConn && key !== msg.peerId) {
            try {
              conn.send(msg);
            } catch (e) {
              // Ignore
            }
          }
        });
      }
    }

    // Notify external listeners (such as collaborationSync.ts or permission popups)
    this.listeners.forEach((listener) => {
      try {
        listener(msg);
      } catch (err) {
        console.error('[Pixelite P2P] ❌ Listener callback error:', err);
      }
    });
  }
}

export const collaborationService = new WebRTCCollaborationService();

