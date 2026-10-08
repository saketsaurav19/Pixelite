/**
 * Pure canvas helpers for MU-1 (layer masks + clipping masks).
 *
 * Every function here is side-effect free: inputs are never mutated and a new
 * canvas is returned. `maskToAlphaCanvas` is a pure function of its input, so
 * callers can memoize it (e.g. keyed on the mask dataUrl + dimensions) to
 * avoid re-decoding masks on every render pass.
 */

import type { Layer } from '../store/types';

const createSizedCanvas = (w: number, h: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  // Guard against zero/negative/NaN sizes so getImageData never throws.
  canvas.width = Math.max(1, Math.round(w) || 1);
  canvas.height = Math.max(1, Math.round(h) || 1);
  return canvas;
};

/**
 * Converts a grayscale mask canvas into an alpha canvas: luminance → alpha.
 * White is fully opaque, black is fully transparent, gray is in between.
 *
 * The output carries the mask in its alpha channel (RGB is white); it is
 * intended to be composited with `globalCompositeOperation = 'destination-in'`.
 * A partially transparent mask pixel contributes proportionally less, i.e.
 * effective alpha = luminance × maskAlpha.
 */
export const maskToAlphaCanvas = (maskCanvas: HTMLCanvasElement): HTMLCanvasElement => {
  const w = maskCanvas.width;
  const h = maskCanvas.height;
  const out = createSizedCanvas(w, h);

  const srcCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
  const outCtx = out.getContext('2d');
  if (!srcCtx || !outCtx) return out;

  // getImageData only reads; the input canvas is never written to.
  const src = srcCtx.getImageData(0, 0, out.width, out.height);
  const dst = outCtx.createImageData(out.width, out.height);
  const s = src.data;
  const d = dst.data;

  for (let i = 0; i < s.length; i += 4) {
    // Rec. 709 luminance.
    const luminance = Math.round(0.2126 * s[i] + 0.7152 * s[i + 1] + 0.0722 * s[i + 2]);
    d[i] = 255;
    d[i + 1] = 255;
    d[i + 2] = 255;
    // Scale by the mask pixel's own alpha so erased mask regions stay hidden.
    d[i + 3] = Math.round((luminance * s[i + 3]) / 255);
  }
  outCtx.putImageData(dst, 0, 0);
  return out;
};

/**
 * Applies a layer mask: returns a NEW canvas (same size as `layerCanvas`)
 * where the layer is visible only where the mask is white.
 *
 * If the mask canvas differs in size from the layer canvas it is scaled to
 * fit the layer canvas — the layer's own size is always authoritative.
 * Neither input is mutated.
 */
export const applyMaskToLayer = (
  layerCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement
): HTMLCanvasElement => {
  const w = layerCanvas.width;
  const h = layerCanvas.height;
  const out = createSizedCanvas(w, h);

  const ctx = out.getContext('2d');
  if (!ctx) return out;

  ctx.drawImage(layerCanvas, 0, 0);

  // destination-in keeps destination pixels only where the source is opaque,
  // multiplying alphas — exactly layer-mask semantics.
  const alpha = maskToAlphaCanvas(maskCanvas);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(alpha, 0, 0, out.width, out.height);
  ctx.globalCompositeOperation = 'source-over';
  return out;
};

/**
 * Applies a Photoshop-style clipping mask: returns a NEW canvas (same size as
 * `clippedCanvas`) where the clipped layer is visible only where the base
 * layer has non-transparent pixels. The clipped layer's own RGB is preserved;
 * its alpha is multiplied by the base layer's alpha.
 *
 * If the base canvas differs in size it is scaled to the clipped canvas size
 * (defensive; see the integration spec for position-offset handling when the
 * two layers sit at different document positions). Neither input is mutated.
 */
export const applyClippingMask = (
  clippedCanvas: HTMLCanvasElement,
  baseCanvas: HTMLCanvasElement
): HTMLCanvasElement => {
  const w = clippedCanvas.width;
  const h = clippedCanvas.height;
  const out = createSizedCanvas(w, h);

  const outCtx = out.getContext('2d');
  if (!outCtx) return out;

  // Build an alpha-only copy of the base: white where the base has pixels,
  // transparent elsewhere.
  const baseAlpha = createSizedCanvas(baseCanvas.width, baseCanvas.height);
  const baseCtx = baseAlpha.getContext('2d');
  if (baseCtx) {
    baseCtx.fillStyle = '#ffffff';
    baseCtx.fillRect(0, 0, baseAlpha.width, baseAlpha.height);
    baseCtx.globalCompositeOperation = 'destination-in';
    baseCtx.drawImage(baseCanvas, 0, 0);
    baseCtx.globalCompositeOperation = 'source-over';
  }

  outCtx.drawImage(clippedCanvas, 0, 0);
  outCtx.globalCompositeOperation = 'destination-in';
  outCtx.drawImage(baseAlpha, 0, 0, out.width, out.height);
  outCtx.globalCompositeOperation = 'source-over';
  return out;
};

// ── Async helpers (decode cache + tree geometry) ─────────────────────────────

/**
 * Memoized async dataUrl → canvas decode. Image decoding is inherently async,
 * so export paths (which are async) await this; the promise is cached per
 * dataUrl so repeated exports / strokes don't re-decode.
 */
const decodeCache = new Map<string, Promise<HTMLCanvasElement>>();

export const decodeDataUrlToCanvas = (dataUrl: string): Promise<HTMLCanvasElement> => {
  const hit = decodeCache.get(dataUrl);
  if (hit) return hit;
  const pending = new Promise<HTMLCanvasElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = createSizedCanvas(img.naturalWidth || 1, img.naturalHeight || 1);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('decodeDataUrlToCanvas: 2D context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('decodeDataUrlToCanvas: image decode failed'));
    img.src = dataUrl;
  });
  // Cap the cache; drop failed decodes so a later call can retry.
  if (decodeCache.size > 32) {
    const oldest = decodeCache.keys().next();
    if (!oldest.done) decodeCache.delete(oldest.value);
  }
  decodeCache.set(dataUrl, pending);
  pending.catch(() => {
    if (decodeCache.get(dataUrl) === pending) decodeCache.delete(dataUrl);
  });
  return pending;
};

/**
 * Document-space offset of a layer: its own position plus every ancestor
 * group's/artboard's position, accumulated from the tree root. Used to align
 * a clipping-mask base canvas under its clipped layer when the two sit at
 * different document positions (or inside groups).
 */
export const getLayerDocumentOffset = (
  layers: Layer[],
  id: string
): { x: number; y: number } | null => {
  const walk = (nodes: Layer[], accX: number, accY: number): { x: number; y: number } | null => {
    for (const node of nodes) {
      const nx = accX + (node.position?.x || 0);
      const ny = accY + (node.position?.y || 0);
      if (node.id === id) return { x: nx, y: ny };
      if (node.children) {
        const found = walk(node.children, nx, ny);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(layers, 0, 0);
};
