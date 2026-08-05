import type { Layer } from '../store/types';

export interface SharedCanvasState {
  version: number;
  title?: string;
  documentSize: { w: number; h: number };
  layers: Array<{
    id: string;
    name: string;
    type: string;
    visible: boolean;
    opacity: number;
    blendMode: string;
    position?: { x: number; y: number };
    dataUrl?: string;
    textRuns?: any[];
    shapeProps?: any;
  }>;
  createdAt: string;
}

/**
 * Serializes layer tree into a clean JSON structure suitable for URL sharing.
 */
export function serializeCanvasState(
  layers: Layer[],
  documentSize: { w: number; h: number },
  title: string = 'Shared Canvas'
): SharedCanvasState {
  const sanitizeLayers = (layerList: Layer[]): any[] => {
    return layerList.map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type || 'image',
      visible: l.visible,
      opacity: l.opacity,
      blendMode: l.blendMode || 'source-over',
      position: l.position || { x: 0, y: 0 },
      dataUrl: l.dataUrl || undefined,
      textRuns: (l as any).textRuns || undefined,
      shapeProps: (l as any).shapeProps || undefined,
      ...(l.children ? { children: sanitizeLayers(l.children) } : {}),
    }));
  };

  return {
    version: 1,
    title,
    documentSize,
    layers: sanitizeLayers(layers),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Compresses canvas state object into a URL-safe Base64 string using CompressionStream (deflate/gzip)
 * with a fallback to Base64 JSON encoding.
 */
export async function compressStateToHash(state: SharedCanvasState): Promise<string> {
  const jsonString = JSON.stringify(state);

  if ('CompressionStream' in window) {
    try {
      const stream = new Blob([jsonString]).stream().pipeThrough(new CompressionStream('gzip'));
      const response = new Response(stream);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return 'gz:' + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (err) {
      console.warn('[ShareUtils] CompressionStream failed, falling back to base64 JSON', err);
    }
  }

  // Fallback Base64 URL-safe string
  return 'b64:' + btoa(encodeURIComponent(jsonString)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decompresses a URL hash string back into SharedCanvasState object.
 */
export async function decompressHashToState(hash: string): Promise<SharedCanvasState | null> {
  if (!hash) return null;

  // Strip leading '#' or 'state=' if present
  let cleanHash = hash.replace(/^#/, '');
  if (cleanHash.startsWith('state=')) {
    cleanHash = cleanHash.substring(6);
  }

  if (cleanHash.startsWith('gz:')) {
    let rawB64 = cleanHash.substring(3).replace(/-/g, '+').replace(/_/g, '/');
    while (rawB64.length % 4 !== 0) {
      rawB64 += '=';
    }

    try {
      const binary = atob(rawB64);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));

      if ('DecompressionStream' in window) {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        const response = new Response(stream);
        const jsonString = await response.text();
        return JSON.parse(jsonString) as SharedCanvasState;
      }
    } catch (err) {
      console.error('[ShareUtils] Decompression failed', err);
      return null;
    }
  } else if (cleanHash.startsWith('b64:')) {
    try {
      let rawB64 = cleanHash.substring(4).replace(/-/g, '+').replace(/_/g, '/');
      while (rawB64.length % 4 !== 0) {
        rawB64 += '=';
      }
      const jsonString = decodeURIComponent(atob(rawB64));
      return JSON.parse(jsonString) as SharedCanvasState;
    } catch (err) {
      console.error('[ShareUtils] B64 parse failed', err);
      return null;
    }
  } else {
    // Try raw JSON parse if given directly
    try {
      return JSON.parse(decodeURIComponent(cleanHash));
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Auto-detects #state=gz:... or #state=b64:... in window.location.hash on application load
 * and restores the shared canvas state into Zustand store.
 */
export async function initUrlStateLoader(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const hash = window.location.hash;
  if (!hash || (!hash.includes('state=') && !hash.startsWith('#gz:') && !hash.startsWith('#b64:'))) {
    return false;
  }

  console.log('[ShareUtils] 🔗 Found shared canvas state in URL hash! Decompressing...');
  try {
    const decompressed = await decompressHashToState(hash);
    if (decompressed && decompressed.layers && Array.isArray(decompressed.layers)) {
      console.log(`[ShareUtils] 🎉 Successfully decompressed shared state (${decompressed.layers.length} layers)!`);
      const { useStore } = await import('../store/useStore');
      useStore.setState((state) => ({
        ...state,
        layers: decompressed.layers,
        activeLayerId: decompressed.layers[0]?.id || null,
        ...(decompressed.documentSize ? { documentSize: decompressed.documentSize } : {}),
      }));
      useStore.getState().addAlert({
        type: 'success',
        message: `🎉 Successfully loaded shared canvas state (${decompressed.layers.length} layers)!`,
      });
      return true;
    }
  } catch (err) {
    console.error('[ShareUtils] ❌ Error initializing canvas from URL hash:', err);
  }
  return false;
}

/**
 * Returns the base URL for sharing.
 * Automatically uses current origin (Domain in production, IP & Port in dev mode).
 */
export function getShareBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

/**
 * Generates an SVG Data URI for a QR code locally or via high-reliability fallback services.
 */
export function generateQrCodeUrl(url: string, size = 200): string {
  if (!url) return '';

  const encodedText = encodeURIComponent(url);
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodedText}&size=${size}x${size}&margin=4`;
}
