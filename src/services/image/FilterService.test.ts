// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

import { ImageData as CanvasImageData } from 'canvas';
(globalThis as any).ImageData = CanvasImageData;

import { FilterService } from './FilterService';

function makeImageData(w: number, h: number): ImageData {
  const img = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      img.data[i] = (x * 13 + y * 7) % 256;
      img.data[i + 1] = (x * 29 + y * 3) % 256;
      img.data[i + 2] = (x * 5 + y * 11) % 256;
      img.data[i + 3] = 255;
    }
  }
  return img;
}

describe('FilterService.applyFilter', () => {
  it('returns null for unknown filter types', () => {
    expect(FilterService.applyFilter('nope', makeImageData(8, 8))).toBeNull();
  });

  it('applies every known filter type and preserves dimensions', () => {
    const types = [
      'average', 'blur', 'gaussian_blur', 'motion_blur', 'displace', 'pinch',
      'ripple', 'wave', 'add_noise', 'dust_scratches', 'median', 'sharpen',
      'sharpen_more', 'unsharp_mask', 'emboss', 'find_edges', 'oil_paint',
      'high_pass', 'maximum', 'minimum', 'duotone', 'halftone', 'glitch',
    ];
    for (const t of types) {
      const out = FilterService.applyFilter(t, makeImageData(16, 16), { radius: 2 });
      expect(out, t).not.toBeNull();
      expect(out!.width).toBe(16);
      expect(out!.height).toBe(16);
    }
  });

  it('is deterministic for blur (same input, same options, same output)', () => {
    const a = FilterService.applyFilter('gaussian_blur', makeImageData(16, 16), { radius: 3 });
    const b = FilterService.applyFilter('gaussian_blur', makeImageData(16, 16), { radius: 3 });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(Array.from(a!.data)).toEqual(Array.from(b!.data));
  });

  it('does not mutate the input image data', () => {
    const input = makeImageData(16, 16);
    const snapshot = Array.from(input.data);
    FilterService.applyFilter('sharpen', input);
    expect(Array.from(input.data)).toEqual(snapshot);
  });
});
