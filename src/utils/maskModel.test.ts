// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

import { createCanvas, loadImage } from 'canvas';

import { createMaskDataUrl, invertMaskPixels, computeClippedAlpha } from './maskModel';

/** Decode a PNG data URL back to raw RGBA pixels via the node `canvas` package. */
async function decodeDataUrl(url: string): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  const img = await loadImage(url);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { width, height, data } = ctx.getImageData(0, 0, img.width, img.height);
  return { width, height, data };
}

describe('createMaskDataUrl', () => {
  it('creates a white reveal-all mask at the requested size', async () => {
    const url = createMaskDataUrl(4, 3, 255);
    expect(url.startsWith('data:image/png')).toBe(true);
    const { width, height, data } = await decodeDataUrl(url);
    expect(width).toBe(4);
    expect(height).toBe(3);
    expect(data.length).toBe(4 * 3 * 4);
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i]).toBe(255);
      expect(data[i + 1]).toBe(255);
      expect(data[i + 2]).toBe(255);
      expect(data[i + 3]).toBe(255);
    }
  });

  it('creates a black hide-all mask', async () => {
    const { data } = await decodeDataUrl(createMaskDataUrl(2, 2, 0));
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i]).toBe(0);
      expect(data[i + 1]).toBe(0);
      expect(data[i + 2]).toBe(0);
      expect(data[i + 3]).toBe(255);
    }
  });

  it('clamps degenerate sizes to at least 1px', async () => {
    const { width, height } = await decodeDataUrl(createMaskDataUrl(0, -5, 255));
    expect(width).toBe(1);
    expect(height).toBe(1);
  });
});

describe('invertMaskPixels', () => {
  it('turns black into white and white into black', () => {
    const black = new Uint8ClampedArray([0, 0, 0, 255]);
    invertMaskPixels(black);
    expect(Array.from(black)).toEqual([255, 255, 255, 255]);

    const white = new Uint8ClampedArray([255, 255, 255, 255]);
    invertMaskPixels(white);
    expect(Array.from(white)).toEqual([0, 0, 0, 255]);
  });

  it('maps mid-gray to its approximate inverse and leaves alpha untouched', () => {
    const px = new Uint8ClampedArray([128, 128, 128, 200]);
    invertMaskPixels(px);
    expect(Array.from(px)).toEqual([127, 127, 127, 200]);
  });

  it('is its own inverse', () => {
    const px = new Uint8ClampedArray([10, 99, 210, 77]);
    const original = Array.from(px);
    invertMaskPixels(px);
    invertMaskPixels(px);
    expect(Array.from(px)).toEqual(original);
  });
});

describe('computeClippedAlpha', () => {
  it('zeroes the result where the base is fully transparent', () => {
    const out = computeClippedAlpha(
      new Uint8ClampedArray([0, 0]),
      new Uint8ClampedArray([200, 255])
    );
    expect(Array.from(out)).toEqual([0, 0]);
  });

  it('preserves the clipped alpha where the base is fully opaque', () => {
    const out = computeClippedAlpha(
      new Uint8ClampedArray([255, 255]),
      new Uint8ClampedArray([200, 0])
    );
    expect(Array.from(out)).toEqual([200, 0]);
  });

  it('scales the clipped alpha by partial base opacity', () => {
    // 128 * 255 / 255 = 128 ; 128 * 128 / 255 ≈ 64.25 -> 64
    const out = computeClippedAlpha(
      new Uint8ClampedArray([128, 128]),
      new Uint8ClampedArray([255, 128])
    );
    expect(Array.from(out)).toEqual([128, 64]);
  });

  it('uses the shorter of the two buffers', () => {
    const out = computeClippedAlpha(
      new Uint8ClampedArray([255, 255, 255]),
      new Uint8ClampedArray([100])
    );
    expect(out.length).toBe(1);
    expect(out[0]).toBe(100);
  });
});
