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
 * Downsamples a dataUrl string to a compact WebP/JPEG format (max 800px)
 * to keep snapshot share URL hashes ultra-compact and prevent browser URL truncation limits.
 */
export async function compressDataUrlForShare(dataUrl: string, maxDim = 800): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image')) return dataUrl;
  if (dataUrl.length < 30000) return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let w = img.width;
      let h = img.height;

      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);

      ctx.drawImage(img, 0, 0, w, h);
      const compactWebP = canvas.toDataURL('image/webp', 0.8);
      if (compactWebP && compactWebP.length < dataUrl.length) {
        resolve(compactWebP);
      } else {
        const compactJpeg = canvas.toDataURL('image/jpeg', 0.8);
        resolve(compactJpeg.length < dataUrl.length ? compactJpeg : dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Ensures all image & paint layers have valid base64 dataUrls created from live DOM canvases
 * prior to JSON state serialization for URL sharing.
 */
export async function ensureLayerDataUrls(layers: Layer[]): Promise<Layer[]> {
  const processedLayers = await Promise.all(
    layers.map(async (layer) => {
      let dataUrl = layer.dataUrl;

      if (!dataUrl && typeof document !== 'undefined') {
        try {
          const domCanvas = document.querySelector(`canvas[data-layer-id="${layer.id}"]`) as HTMLCanvasElement;
          if (domCanvas && domCanvas.width > 0 && domCanvas.height > 0) {
            dataUrl = domCanvas.toDataURL('image/png');
          }
        } catch (e) {
          // Ignore
        }
      }

      // Downsample large base64 image dataUrls for URL state hash link generation
      if (dataUrl) {
        dataUrl = await compressDataUrlForShare(dataUrl);
      }

      let children = layer.children;
      if (children && children.length > 0) {
        children = await ensureLayerDataUrls(children);
      }

      return {
        ...layer,
        ...(dataUrl ? { dataUrl } : {}),
        ...(children ? { children } : {}),
      };
    })
  );

  return processedLayers;
}

/**
 * Serializes layer tree into a clean JSON structure suitable for URL sharing.
 */
export function serializeCanvasState(
  layers: Layer[],
  documentSize: { w: number; h: number },
  title: string = 'Shared Canvas',
  canvasRefs?: React.MutableRefObject<Record<string, HTMLCanvasElement | null>>
): SharedCanvasState {
  const sanitizeLayers = (layerList: Layer[]): any[] => {
    return layerList.map((l) => {
      let resolvedDataUrl = l.dataUrl;
      if (!resolvedDataUrl) {
        try {
          const domCanvas = canvasRefs?.current?.[l.id] ||
            (typeof document !== 'undefined' ? (document.querySelector(`canvas[data-layer-id="${l.id}"]`) as HTMLCanvasElement) : null);
          if (domCanvas && domCanvas.width > 0 && domCanvas.height > 0) {
            resolvedDataUrl = domCanvas.toDataURL();
          }
        } catch (e) {
          // Ignore
        }
      }

      const clean: any = {
        id: l.id,
        name: l.name,
        type: l.type || 'image',
        visible: l.visible,
        locked: l.locked || false,
        opacity: l.opacity ?? 1,
        fill: l.fill,
        blendMode: l.blendMode || 'source-over',
        position: l.position || { x: 0, y: 0 },
        width: l.width,
        height: l.height,
        rotation: l.rotation,
        dataUrl: resolvedDataUrl || undefined,

        // Text layer properties
        textContent: l.textContent,
        fontSize: l.fontSize,
        fontFamily: l.fontFamily,
        color: l.color,
        strokeColor: l.strokeColor,
        strokeWidth: l.strokeWidth,
        fontWeight: l.fontWeight,
        fontStyle: l.fontStyle,
        textAlign: l.textAlign,
        isVertical: l.isVertical,
        runs: l.runs,
        shapedPositions: l.shapedPositions,
        textWarp: (l as any).textWarp,

        // Vector shape & table properties
        shapeData: l.shapeData,
        tableData: (l as any).tableData,

        // Artboard & Adjustment layer properties
        backgroundColor: l.backgroundColor,
        backgroundTransparent: l.backgroundTransparent,
        adjustmentData: l.adjustmentData,
      };

      if (l.children && l.children.length > 0) {
        clean.children = sanitizeLayers(l.children);
      }

      // Remove undefined properties to keep JSON payload clean
      Object.keys(clean).forEach((key) => {
        if (clean[key] === undefined) {
          delete clean[key];
        }
      });

      return clean;
    });
  };

  return {
    version: 1,
    title,
    documentSize,
    layers: sanitizeLayers(layers),
    createdAt: new Date().toISOString(),
  };
}

// Key Minification Mapping for URL Hash Compression
const KEY_MAP: Record<string, string> = {
  id: 'i',
  name: 'n',
  type: 't',
  visible: 'v',
  locked: 'l',
  opacity: 'o',
  fill: 'fl',
  blendMode: 'bm',
  position: 'p',
  width: 'w',
  height: 'h',
  rotation: 'r',
  dataUrl: 'd',
  textContent: 'tc',
  fontSize: 'fs',
  fontFamily: 'ff',
  color: 'c',
  strokeColor: 'sc',
  strokeWidth: 'sw',
  fontWeight: 'fw',
  fontStyle: 'fst',
  textAlign: 'ta',
  isVertical: 'iv',
  runs: 'rn',
  shapedPositions: 'sp',
  textWarp: 'tw',
  shapeData: 'sd',
  tableData: 'td',
  backgroundColor: 'bgc',
  backgroundTransparent: 'bgt',
  adjustmentData: 'ad',
  children: 'ch',
  documentSize: 'ds',
  layers: 'ly',
  version: 'vr',
  createdAt: 'ca',
  title: 'tl',
};

const REVERSE_KEY_MAP: Record<string, string> = Object.entries(KEY_MAP).reduce(
  (acc, [k, v]) => {
    acc[v] = k;
    return acc;
  },
  {} as Record<string, string>
);

export function minifyState(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(minifyState);
  }
  if (obj && typeof obj === 'object') {
    const min: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val === undefined || val === null) continue;
      if (key === 'visible' && val === true) continue;
      if (key === 'opacity' && val === 1) continue;
      if (key === 'locked' && val === false) continue;
      if (key === 'blendMode' && val === 'source-over') continue;
      if (key === 'position' && (val as any).x === 0 && (val as any).y === 0) continue;

      const minKey = KEY_MAP[key] || key;
      min[minKey] = minifyState(val);
    }
    return min;
  }
  return obj;
}

export function unminifyState(min: any): any {
  if (Array.isArray(min)) {
    return min.map(unminifyState);
  }
  if (min && typeof min === 'object') {
    const orig: any = {};
    for (const [key, val] of Object.entries(min)) {
      const origKey = REVERSE_KEY_MAP[key] || key;
      orig[origKey] = unminifyState(val);
    }
    return orig;
  }
  return min;
}

/**
 * Compresses canvas state object into a URL-safe Base64 string using Minified JSON + CompressionStream (gzip)
 * with a fallback to Base64 JSON encoding.
 */
export async function compressStateToHash(state: SharedCanvasState): Promise<string> {
  console.log('[ShareUtils] 📦 Encoded Canvas State JSON:\n', JSON.stringify(state, null, 2));
  const minified = minifyState(state);
  const jsonString = JSON.stringify(minified);

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
        const ds = new DecompressionStream('gzip');
        const writer = ds.writable.getWriter();
        writer.write(bytes);
        writer.close();

        const reader = ds.readable.getReader();
        const decoder = new TextDecoder();
        let jsonString = '';
        let result = await reader.read();

        while (!result.done) {
          jsonString += decoder.decode(result.value, { stream: true });
          result = await reader.read();
        }
        jsonString += decoder.decode();

        const parsed = JSON.parse(jsonString);
        return unminifyState(parsed) as SharedCanvasState;
      }
    } catch (err) {
      console.warn('[ShareUtils] GZIP URL hash decompression failed (URL likely truncated by browser limits):', err);
      return null;
    }
  } else if (cleanHash.startsWith('b64:')) {
    try {
      let rawB64 = cleanHash.substring(4).replace(/-/g, '+').replace(/_/g, '/');
      while (rawB64.length % 4 !== 0) {
        rawB64 += '=';
      }
      const jsonString = decodeURIComponent(atob(rawB64));
      const parsed = JSON.parse(jsonString);
      return unminifyState(parsed) as SharedCanvasState;
    } catch (err) {
      console.error('[ShareUtils] B64 parse failed', err);
      return null;
    }
  } else {
    // Try raw JSON parse if given directly
    try {
      const parsed = JSON.parse(decodeURIComponent(cleanHash));
      return unminifyState(parsed);
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
      console.log('[ShareUtils] 📄 Decompressed Canvas State JSON:\n', JSON.stringify(decompressed, null, 2));
      const docSize = decompressed.documentSize
        ? {
            w: (decompressed.documentSize as any).w ?? (decompressed.documentSize as any).width ?? 800,
            h: (decompressed.documentSize as any).h ?? (decompressed.documentSize as any).height ?? 600,
          }
        : undefined;

      const { useStore } = await import('../store/useStore');
      useStore.setState((state) => ({
        ...state,
        layers: decompressed.layers,
        activeLayerId: decompressed.layers[0]?.id || null,
        ...(docSize ? { documentSize: docSize } : {}),
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
 * Splits a long URL or string into sequence chunks (e.g. S1/3|..., S2/3|..., S3/3|...)
 * for rendering as animated QR slides.
 */
export function splitUrlIntoQrChunks(url: string, maxChunkSize = 350): string[] {
  if (!url) return [];
  if (url.length <= maxChunkSize) return [url];

  const totalChunks = Math.ceil(url.length / maxChunkSize);
  const chunks: string[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * maxChunkSize;
    const part = url.substring(start, start + maxChunkSize);
    chunks.push(`S${i + 1}/${totalChunks}|${part}`);
  }

  return chunks;
}

/**
 * Generates an SVG Data URI for a QR code locally or via high-reliability fallback services.
 */
export function generateQrCodeUrl(url: string, size = 200): string {
  if (!url) return '';

  const encodedText = encodeURIComponent(url);
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodedText}&size=${size}x${size}&margin=4`;
}
