/**
 * MU-1 mask model — pure, dependency-free helpers for layer masks and
 * clipping masks. No store imports, no DOM beyond a transient canvas;
 * every function is unit-testable in isolation.
 */

/**
 * Builds a grayscale PNG data URL for a new layer mask.
 * `fill` is the 8-bit gray value every pixel starts at:
 * 255 = reveal-all (white), 0 = hide-all (black).
 * The mask is `width` x `height` pixels — callers must pass the layer's
 * own canvas size so the mask aligns with the composite.
 */
export function createMaskDataUrl(width: number, height: number, fill: 0 | 255): string {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('createMaskDataUrl: 2D canvas context unavailable');
  const gray = fill === 255 ? 255 : 0;
  ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
  ctx.fillRect(0, 0, w, h);
  return canvas.toDataURL('image/png');
}

/**
 * Inverts the R/G/B channels of an RGBA pixel buffer in place
 * (black <-> white). The alpha channel is left untouched, and so are the
 * layer's own pixels — only the mask buffer is modified.
 */
export function invertMaskPixels(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
    // data[i + 3] (alpha) deliberately untouched
  }
}

/**
 * Clipping-mask alpha math: the clipped layer shows only where the base
 * layer is opaque. Per pixel: result = clipped * base / 255.
 * Operates on alpha-only buffers; the returned buffer has
 * `Math.min(baseAlpha.length, clippedAlpha.length)` entries.
 */
export function computeClippedAlpha(
  baseAlpha: Uint8ClampedArray,
  clippedAlpha: Uint8ClampedArray
): Uint8ClampedArray {
  const len = Math.min(baseAlpha.length, clippedAlpha.length);
  const out = new Uint8ClampedArray(len);
  for (let i = 0; i < len; i++) {
    out[i] = Math.round((clippedAlpha[i] * baseAlpha[i]) / 255);
  }
  return out;
}
