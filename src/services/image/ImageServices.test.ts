// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

import { ImageData as CanvasImageData } from 'canvas';
(globalThis as any).ImageData = CanvasImageData;

import { CanvasSizeService } from './CanvasSizeService';
import { ImageResizeService } from './ImageResizeService';

describe('CanvasSizeService', () => {
  it('computes correct anchor offsets', () => {
    // 1000x1000 to 1500x1500 (expanding)
    // Center: dx = 250, dy = 250
    const centerOffset = CanvasSizeService.getAnchorOffset(1000, 1000, 1500, 1500, 'center');
    expect(centerOffset).toEqual({ x: 250, y: 250 });

    // Top-Left: dx = 0, dy = 0
    const topLeftOffset = CanvasSizeService.getAnchorOffset(1000, 1000, 1500, 1500, 'top-left');
    expect(topLeftOffset).toEqual({ x: 0, y: 0 });

    // Bottom-Right: dx = 500, dy = 500
    const bottomRightOffset = CanvasSizeService.getAnchorOffset(1000, 1000, 1500, 1500, 'bottom-right');
    expect(bottomRightOffset).toEqual({ x: 500, y: 500 });
  });

  it('correctly crops layer dimensions to canvas bounds', () => {
    // A canvas of 10x10. A layer at (5, 5) with dimensions 10x10.
    // The overlap (intersection) is from (5, 5) to (10, 10) -> size is 5x5.
    const mockCanvas = document.createElement('canvas');
    mockCanvas.width = 10;
    mockCanvas.height = 10;

    const result = CanvasSizeService.cropLayerImage(mockCanvas, { x: 5, y: 5 }, 10, 10);
    expect(result.width).toBe(5);
    expect(result.height).toBe(5);
    expect(result.position).toEqual({ x: 5, y: 5 });
    expect(result.dataUrl).toBeDefined();
  });

  it('returns small placeholder when layer is completely cropped out', () => {
    const mockCanvas = document.createElement('canvas');
    mockCanvas.width = 10;
    mockCanvas.height = 10;

    // Layer completely outside canvas: at (-20, -20)
    const result = CanvasSizeService.cropLayerImage(mockCanvas, { x: -20, y: -20 }, 10, 10);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.dataUrl).toBeDefined();
  });
});

describe('ImageResizeService', () => {
  it('correctly resamples pixels using nearest neighbor interpolation', () => {
    // 2x2 to 4x4
    const src = new ImageData(2, 2);
    // Fill top-left with red (255, 0, 0, 255)
    src.data[0] = 255; src.data[3] = 255;

    const dst = ImageResizeService.resampleNearest(src, 4, 4);
    expect(dst.width).toBe(4);
    expect(dst.height).toBe(4);
    // Top-left target pixel should be red
    expect(dst.data[0]).toBe(255);
    expect(dst.data[3]).toBe(255);
  });

  it('correctly resamples pixels using bilinear interpolation', () => {
    const src = new ImageData(2, 2);
    src.data[0] = 100; src.data[3] = 255;
    src.data[4] = 200; src.data[7] = 255;

    const dst = ImageResizeService.resampleBilinear(src, 3, 3);
    expect(dst.width).toBe(3);
    expect(dst.data[0]).toBe(100);
    expect(dst.data[4]).toBe(150); // midpoint (100 + 200) / 2
    expect(dst.data[8]).toBe(200);
  });

  it('correctly resamples pixels using bicubic interpolation', () => {
    const src = new ImageData(4, 4);
    src.data[0] = 100; src.data[3] = 255;

    const dst = ImageResizeService.resampleBicubic(src, 8, 8);
    expect(dst.width).toBe(8);
    expect(dst.height).toBe(8);
  });

  it('correctly resamples pixels using Lanczos windowed sinc interpolation', () => {
    const src = new ImageData(4, 4);
    src.data[0] = 100; src.data[3] = 255;

    const dst = ImageResizeService.resampleLanczos(src, 8, 8);
    expect(dst.width).toBe(8);
    expect(dst.height).toBe(8);
  });
});
