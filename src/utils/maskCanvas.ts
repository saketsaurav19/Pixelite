/**
 * MU-1 paint-on-mask support.
 *
 * Brush/pencil/eraser strokes targeting a layer mask must NOT touch the
 * layer's working canvas (stroke persistence serializes that canvas, so any
 * mask pixels baked into it would corrupt the layer). Instead, each mask gets
 * its own off-DOM paint canvas, held in a module-level cache:
 *
 * - `getMaskPaintCanvas(layerId)` — the canvas painting tools draw into,
 *   sized to the layer's working canvas so stroke coordinates map 1:1.
 *   Lazily decodes the current `layerMask.dataUrl` into it (async preload so
 *   the first stroke isn't blank); re-syncs if the store's dataUrl changes
 *   underneath it (undo/redo, invert, …).
 * - `commitMaskPaint(layerId)` — encodes the paint canvas back to a dataUrl
 *   and persists it via `updateLayerMaskDataUrl`. Called once per stroke.
 * - `toGrayscaleColor(hex)` — forces brush colors to Rec.709 gray so mask
 *   painting can never tint the mask.
 */

import { useStore } from '../store/useStore';
import { findLayerById } from './layerUtils';
import { decodeDataUrlToCanvas } from './maskRender';

interface MaskPaintEntry {
  canvas: HTMLCanvasElement;
  /** dataUrl the canvas pixels currently reflect (null = not yet synced). */
  sourceDataUrl: string | null;
  /** dataUrl currently being decoded into the canvas, if any. */
  pendingDataUrl: string | null;
}

const entries = new Map<string, MaskPaintEntry>();

const resolveMaskSize = (layerId: string): { w: number; h: number } => {
  // Prefer the live working canvas: painting coords are in its space.
  const el = document.querySelector(
    `canvas[data-layer-id="${layerId}"]`
  ) as HTMLCanvasElement | null;
  if (el && el.width > 0 && el.height > 0) {
    return { w: el.width, h: el.height };
  }
  const st = useStore.getState();
  const layer = findLayerById(st.layers, layerId);
  const w = Math.max(1, Math.round(layer?.width || st.documentSize.w || 1));
  const h = Math.max(1, Math.round(layer?.height || st.documentSize.h || 1));
  return { w, h };
};

const syncEntry = (layerId: string, dataUrl: string): void => {
  const entry = entries.get(layerId);
  if (!entry) return;
  if (entry.sourceDataUrl === dataUrl || entry.pendingDataUrl === dataUrl) return;
  entry.pendingDataUrl = dataUrl;
  decodeDataUrlToCanvas(dataUrl)
    .then((maskCanvas) => {
      const e = entries.get(layerId);
      if (!e || e.pendingDataUrl !== dataUrl) return; // superseded
      const ctx = e.canvas.getContext('2d');
      if (ctx) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, e.canvas.width, e.canvas.height);
        ctx.drawImage(maskCanvas, 0, 0, e.canvas.width, e.canvas.height);
      }
      e.sourceDataUrl = dataUrl;
      e.pendingDataUrl = null;
    })
    .catch(() => {
      const e = entries.get(layerId);
      if (e && e.pendingDataUrl === dataUrl) e.pendingDataUrl = null;
    });
};

/**
 * Returns the off-DOM canvas that mask-painting strokes for `layerId` draw
 * into, or null when the layer has no mask (the cache entry is dropped).
 * The first call kicks off an async decode of the current mask dataUrl —
 * call `preloadMaskPaintCanvas` when the mask becomes active so the decode
 * finishes before the first stroke lands.
 */
export const getMaskPaintCanvas = (layerId: string): HTMLCanvasElement | null => {
  const st = useStore.getState();
  const layer = findLayerById(st.layers, layerId);
  const mask = layer?.layerMask;
  if (!mask) {
    entries.delete(layerId);
    return null;
  }
  let entry = entries.get(layerId);
  if (!entry) {
    const { w, h } = resolveMaskSize(layerId);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    entry = { canvas, sourceDataUrl: null, pendingDataUrl: null };
    entries.set(layerId, entry);
  }
  if (entry.sourceDataUrl !== mask.dataUrl) {
    syncEntry(layerId, mask.dataUrl);
  }
  return entry.canvas;
};

/**
 * Fire-and-forget decode of the mask's current dataUrl into the paint cache.
 * Call when a mask becomes the paint target (or its dataUrl changes) so the
 * first stroke paints onto the real mask instead of a blank canvas.
 */
export const preloadMaskPaintCanvas = (layerId: string): void => {
  getMaskPaintCanvas(layerId);
};

/**
 * Persists the paint canvas back to the store as the layer's new mask
 * dataUrl. Returns the dataUrl, or null when there is nothing to commit.
 * History recording is the caller's job (`updateLayerMaskDataUrl` deliberately
 * records nothing itself).
 */
export const commitMaskPaint = (layerId: string): string | null => {
  const st = useStore.getState();
  const layer = findLayerById(st.layers, layerId);
  const entry = entries.get(layerId);
  if (!layer?.layerMask || !entry) return null;
  const dataUrl = entry.canvas.toDataURL('image/png');
  entry.sourceDataUrl = dataUrl;
  entry.pendingDataUrl = null;
  st.updateLayerMaskDataUrl(layerId, dataUrl);
  return dataUrl;
};

/** Drops a cached paint canvas (e.g. after mask deletion). */
export const clearMaskPaintCache = (layerId?: string): void => {
  if (layerId) entries.delete(layerId);
  else entries.clear();
};

/**
 * Forces a brush color to its Rec.709 luminance gray (`rgb(l, l, l)`), so
 * painting on a mask can never tint it. Unparseable inputs pass through.
 */
export const toGrayscaleColor = (color: string): string => {
  const c = color.trim();
  let r: number, g: number, b: number;
  const hex6 = /^#([0-9a-f]{6})$/i.exec(c);
  const hex3 = /^#([0-9a-f]{3})$/i.exec(c);
  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i.exec(c);
  if (hex6) {
    r = parseInt(hex6[1].slice(0, 2), 16);
    g = parseInt(hex6[1].slice(2, 4), 16);
    b = parseInt(hex6[1].slice(4, 6), 16);
  } else if (hex3) {
    r = parseInt(hex3[1][0] + hex3[1][0], 16);
    g = parseInt(hex3[1][1] + hex3[1][1], 16);
    b = parseInt(hex3[1][2] + hex3[1][2], 16);
  } else if (rgb) {
    r = Math.min(255, parseInt(rgb[1], 10));
    g = Math.min(255, parseInt(rgb[2], 10));
    b = Math.min(255, parseInt(rgb[3], 10));
  } else {
    return color;
  }
  const l = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
  return `rgb(${l}, ${l}, ${l})`;
};
