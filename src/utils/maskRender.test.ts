// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

import { maskToAlphaCanvas, applyMaskToLayer, applyClippingMask, getLayerDocumentOffset } from './maskRender';

const makeCanvas = (w: number, h: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
};

const fillCanvas = (canvas: HTMLCanvasElement, color: string): void => {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
};

const readPixels = (canvas: HTMLCanvasElement): Uint8ClampedArray => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
};

describe('maskToAlphaCanvas', () => {
  it('maps a white mask to fully opaque alpha', () => {
    const mask = makeCanvas(4, 4);
    fillCanvas(mask, '#ffffff');

    const alpha = maskToAlphaCanvas(mask);
    expect(alpha.width).toBe(4);
    expect(alpha.height).toBe(4);

    const pixels = readPixels(alpha);
    for (let i = 3; i < pixels.length; i += 4) {
      expect(pixels[i]).toBe(255);
    }
  });

  it('maps a black mask to fully transparent alpha', () => {
    const mask = makeCanvas(4, 4);
    fillCanvas(mask, '#000000');

    const pixels = readPixels(maskToAlphaCanvas(mask));
    for (let i = 3; i < pixels.length; i += 4) {
      expect(pixels[i]).toBe(0);
    }
  });

  it('maps 50% gray to half alpha', () => {
    const mask = makeCanvas(4, 4);
    fillCanvas(mask, '#808080'); // 128,128,128

    const pixels = readPixels(maskToAlphaCanvas(mask));
    expect(pixels[3]).toBe(128);
  });

  it('does not mutate the input mask canvas', () => {
    const mask = makeCanvas(4, 4);
    fillCanvas(mask, '#808080');
    const before = Array.from(readPixels(mask));

    maskToAlphaCanvas(mask);

    expect(Array.from(readPixels(mask))).toEqual(before);
  });
});

describe('applyMaskToLayer', () => {
  it('white mask preserves layer pixels', () => {
    const layer = makeCanvas(4, 4);
    fillCanvas(layer, 'rgb(255, 0, 0)');
    const mask = makeCanvas(4, 4);
    fillCanvas(mask, '#ffffff');

    const result = applyMaskToLayer(layer, mask);
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);

    const pixels = readPixels(result);
    for (let i = 0; i < pixels.length; i += 4) {
      expect(pixels[i]).toBe(255); // red preserved
      expect(pixels[i + 1]).toBe(0);
      expect(pixels[i + 2]).toBe(0);
      expect(pixels[i + 3]).toBe(255); // opaque preserved
    }
  });

  it('black mask clears all alpha', () => {
    const layer = makeCanvas(4, 4);
    fillCanvas(layer, 'rgb(255, 0, 0)');
    const mask = makeCanvas(4, 4);
    fillCanvas(mask, '#000000');

    const pixels = readPixels(applyMaskToLayer(layer, mask));
    for (let i = 3; i < pixels.length; i += 4) {
      expect(pixels[i]).toBe(0);
    }
  });

  it('50% gray mask halves the layer alpha', () => {
    const layer = makeCanvas(4, 4);
    fillCanvas(layer, 'rgb(255, 0, 0)');
    const mask = makeCanvas(4, 4);
    fillCanvas(mask, '#808080');

    const pixels = readPixels(applyMaskToLayer(layer, mask));
    expect(pixels[3]).toBe(128);
    expect(pixels[0]).toBe(255); // RGB untouched
  });

  it('returns a new canvas and does not mutate inputs', () => {
    const layer = makeCanvas(4, 4);
    fillCanvas(layer, 'rgb(255, 0, 0)');
    const mask = makeCanvas(4, 4);
    fillCanvas(mask, '#000000');
    const layerBefore = Array.from(readPixels(layer));
    const maskBefore = Array.from(readPixels(mask));

    const result = applyMaskToLayer(layer, mask);

    expect(result).not.toBe(layer);
    expect(result).not.toBe(mask);
    expect(Array.from(readPixels(layer))).toEqual(layerBefore);
    expect(Array.from(readPixels(mask))).toEqual(maskBefore);
  });

  it('scales a mismatched-size mask to the layer canvas size', () => {
    const layer = makeCanvas(8, 8);
    fillCanvas(layer, 'rgb(0, 0, 255)');
    const mask = makeCanvas(2, 2); // smaller than the layer
    fillCanvas(mask, '#ffffff');

    const result = applyMaskToLayer(layer, mask);
    expect(result.width).toBe(8);
    expect(result.height).toBe(8);

    const pixels = readPixels(result);
    for (let i = 3; i < pixels.length; i += 4) {
      expect(pixels[i]).toBe(255);
    }
  });
});

describe('applyClippingMask', () => {
  it('fully transparent base clears the clipped layer', () => {
    const clipped = makeCanvas(4, 4);
    fillCanvas(clipped, 'rgb(255, 0, 0)');
    const base = makeCanvas(4, 4); // left transparent

    const pixels = readPixels(applyClippingMask(clipped, base));
    for (let i = 3; i < pixels.length; i += 4) {
      expect(pixels[i]).toBe(0);
    }
  });

  it('opaque base preserves the clipped layer pixels', () => {
    const clipped = makeCanvas(4, 4);
    fillCanvas(clipped, 'rgb(255, 0, 0)');
    const base = makeCanvas(4, 4);
    fillCanvas(base, 'rgb(0, 255, 0)');

    const pixels = readPixels(applyClippingMask(clipped, base));
    for (let i = 0; i < pixels.length; i += 4) {
      expect(pixels[i]).toBe(255); // clipped RGB preserved, not the base's
      expect(pixels[i + 1]).toBe(0);
      expect(pixels[i + 2]).toBe(0);
      expect(pixels[i + 3]).toBe(255);
    }
  });

  it('partially transparent base scales the clipped alpha', () => {
    const clipped = makeCanvas(4, 4);
    fillCanvas(clipped, 'rgb(255, 0, 0)');
    const base = makeCanvas(4, 4);
    const bctx = base.getContext('2d')!;
    bctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
    bctx.fillRect(0, 0, 4, 4);

    const pixels = readPixels(applyClippingMask(clipped, base));
    // node-canvas rounds 0.5 alpha to 128; destination-in multiplies: 255 * 128/255
    expect(pixels[3]).toBeGreaterThan(100);
    expect(pixels[3]).toBeLessThan(160);
  });

  it('returns a new canvas and does not mutate inputs', () => {
    const clipped = makeCanvas(4, 4);
    fillCanvas(clipped, 'rgb(255, 0, 0)');
    const base = makeCanvas(4, 4);
    fillCanvas(base, 'rgb(0, 255, 0)');
    const clippedBefore = Array.from(readPixels(clipped));
    const baseBefore = Array.from(readPixels(base));

    const result = applyClippingMask(clipped, base);

    expect(result).not.toBe(clipped);
    expect(result).not.toBe(base);
    expect(Array.from(readPixels(clipped))).toEqual(clippedBefore);
    expect(Array.from(readPixels(base))).toEqual(baseBefore);
  });

  it('handles a mismatched-size base by scaling to the clipped canvas size', () => {
    const clipped = makeCanvas(8, 8);
    fillCanvas(clipped, 'rgb(255, 0, 0)');
    const base = makeCanvas(2, 2);
    fillCanvas(base, 'rgb(0, 255, 0)');

    const result = applyClippingMask(clipped, base);
    expect(result.width).toBe(8);
    expect(result.height).toBe(8);

    const pixels = readPixels(result);
    for (let i = 3; i < pixels.length; i += 4) {
      expect(pixels[i]).toBe(255);
    }
  });
});

describe('getLayerDocumentOffset', () => {
  const lay = (id: string, x = 0, y = 0, children?: any[]): any => ({
    id,
    position: { x, y },
    ...(children ? { children } : {}),
  });

  it('returns the position of a top-level layer', () => {
    const layers = [lay('a', 10, 20), lay('b', 30, 40)];
    expect(getLayerDocumentOffset(layers, 'b')).toEqual({ x: 30, y: 40 });
  });

  it('accumulates ancestor group offsets', () => {
    const layers = [lay('g', 100, 50, [lay('inner', 7, 8)])];
    expect(getLayerDocumentOffset(layers, 'inner')).toEqual({ x: 107, y: 58 });
  });

  it('returns null for an unknown id', () => {
    expect(getLayerDocumentOffset([lay('a')], 'missing')).toBeNull();
  });

  it('treats a missing position as the origin', () => {
    const layers = [{ id: 'a' } as any];
    expect(getLayerDocumentOffset(layers, 'a')).toEqual({ x: 0, y: 0 });
  });
});
