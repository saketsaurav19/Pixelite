// mergeUtils — rasterize-all helper used by the "Merge Down" command.
//
// Replicates the visible document by walking the layer tree bottom-to-top and
// drawing each visible layer's content onto a working canvas the size of the
// document, then returns a PNG `dataURL` for storage on a fresh `paint` layer.
//
// Source-of-truth per layer type:
//   - layers with a `dataUrl` (image, imported PDF background, rasterized
//     paint, etc.) → load the dataUrl and draw it at `(position.x, position.y)`
//     sized to the layer's `(width, height)`. This is the canonical content
//     and is the most reliable because the per-layer DOM canvas might still
//     be empty while the `Image` is loading.
//   - layers without a `dataUrl` (active paint layer with brush strokes,
//     text layer, shape layer, etc.) → read the per-layer
//     `<canvas data-layer-id>` element from the DOM and draw that at
//     `(position.x, position.y)`. The DOM canvas is the source-of-truth for
//     stroke-based content.

import type { Layer } from '../store/types';
import { flattenTree } from './layerUtils';
import { mapBlendModeToCanvas } from './blendModes';

export interface RasterizeAllOptions {
  /** When true, skip layers with `visible: false`. Default: true. */
  onlyVisible?: boolean;
  /** Optional override for the output size. Defaults to `documentSize`. */
  size?: { w: number; h: number };
}

interface ImageEntry {
  bitmap: CanvasImageSource;
  w: number;
  h: number;
  x: number;
  y: number;
  opacity: number;
  blend: GlobalCompositeOperation;
}

const isCanvasImageSource = (v: any): v is CanvasImageSource =>
  v && (typeof v.width === 'number' || typeof v.naturalWidth === 'number');

const loadDataUrl = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url.slice(0, 64)}…`));
    img.src = url;
  });

const collectEntries = async (
  layers: Layer[],
  onlyVisible: boolean
): Promise<ImageEntry[]> => {
  const flat = flattenTree(layers);
  // Walk bottom→top: `flattenTree` returns top→bottom, so reverse for
  // compositor order. The composite reads bottom first, then paints each
  // successive layer on top.
  const ordered = [...flat].reverse();
  const out: ImageEntry[] = [];
  const layerCanvases = new Map<string, HTMLCanvasElement | null>();

  const tryGetLayerCanvas = (id: string): HTMLCanvasElement | null => {
    if (layerCanvases.has(id)) return layerCanvases.get(id) ?? null;
    let el: HTMLCanvasElement | null = null;
    try {
      el = document.querySelector<HTMLCanvasElement>(`canvas[data-layer-id="${id}"]`);
    } catch {
      el = null;
    }
    layerCanvases.set(id, el);
    return el;
  };

  for (const layer of ordered) {
    if (!layer) continue;
    if (onlyVisible && layer.visible === false) continue;
    if (layer.type === 'group' || layer.type === 'artboard') continue;
    if (layer.type === 'adjustment') continue; // adjustments modify layers below; they have no intrinsic pixels

    const pos = layer.position || { x: 0, y: 0 };
    const opacity = layer.opacity ?? 1;
    const blend = mapBlendModeToCanvas(layer.blendMode as any);

    // 1. Preferred source: stored dataUrl.
    if (layer.dataUrl && layer.dataUrl.startsWith('data:')) {
      try {
        const img = await loadDataUrl(layer.dataUrl);
        const w = layer.width || img.naturalWidth || 0;
        const h = layer.height || img.naturalHeight || 0;
        if (w > 0 && h > 0) {
          out.push({ bitmap: img, w, h, x: pos.x, y: pos.y, opacity, blend });
          continue;
        }
      } catch {
        // fall through to DOM canvas
      }
    }

    // 2. Fallback: per-layer DOM canvas.
    const lc = tryGetLayerCanvas(layer.id);
    if (lc && lc.width > 0 && lc.height > 0 && isCanvasImageSource(lc)) {
      out.push({
        bitmap: lc,
        w: lc.width,
        h: lc.height,
        x: pos.x,
        y: pos.y,
        opacity,
        blend,
      });
    }
  }
  return out;
};

export const rasterizeAllToDataUrl = async (
  layers: Layer[],
  documentSize: { w: number; h: number },
  options: RasterizeAllOptions = {}
): Promise<{ dataUrl: string; size: { w: number; h: number } } | null> => {
  const { onlyVisible = true, size } = options;
  const outW = Math.max(1, Math.floor(size?.w ?? documentSize?.w ?? 1));
  const outH = Math.max(1, Math.floor(size?.h ?? documentSize?.h ?? 1));

  const entries = await collectEntries(layers, onlyVisible);
  if (entries.length === 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  for (const e of entries) {
    const prevAlpha = ctx.globalAlpha;
    const prevOp = ctx.globalCompositeOperation;
    ctx.globalAlpha = e.opacity;
    ctx.globalCompositeOperation = e.blend;
    try {
      ctx.drawImage(e.bitmap, e.x, e.y, e.w, e.h);
    } catch {
      // Skip layers that can't be drawn (e.g. cross-origin or disposed).
    }
    ctx.globalAlpha = prevAlpha;
    ctx.globalCompositeOperation = prevOp;
  }

  return { dataUrl: canvas.toDataURL('image/png'), size: { w: outW, h: outH } };
};
