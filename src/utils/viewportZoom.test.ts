// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { computeFitZoom, getCanvasViewportSize } from './viewportZoom';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getCanvasViewportSize', () => {
  it('measures the mounted .canvas-viewport element when present', () => {
    const el = document.createElement('div');
    el.className = 'canvas-viewport';
    document.body.appendChild(el);
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      width: 390, height: 714, x: 0, y: 0, top: 0, left: 0, right: 390, bottom: 714,
      toJSON: () => ({}),
    } as DOMRect);
    try {
      expect(getCanvasViewportSize()).toEqual({ w: 390, h: 714 });
    } finally {
      el.remove();
    }
  });

  it('falls back to mobile-aware window chrome when the element is missing', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(844);
    expect(getCanvasViewportSize()).toEqual({ w: 390, h: 844 - 50 - 44 - 36 });
  });

  it('falls back to desktop chrome on wide windows', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1920);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(1080);
    expect(getCanvasViewportSize()).toEqual({ w: 1920 - 344, h: 1080 - 134 });
  });
});

describe('computeFitZoom', () => {
  it('fits a 1920x1080 document into a phone viewport', () => {
    const el = document.createElement('div');
    el.className = 'canvas-viewport';
    document.body.appendChild(el);
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      width: 390, height: 714, x: 0, y: 0, top: 0, left: 0, right: 390, bottom: 714,
      toJSON: () => ({}),
    } as DOMRect);
    try {
      const zoom = computeFitZoom(1920, 1080);
      // width-constrained: 390 * 0.94 / 1920
      expect(zoom).toBeCloseTo((390 * 0.94) / 1920, 5);
      expect(zoom).toBeLessThan(0.5);
    } finally {
      el.remove();
    }
  });

  it('fits a portrait document by its constraining dimension', () => {
    const el = document.createElement('div');
    el.className = 'canvas-viewport';
    document.body.appendChild(el);
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      width: 390, height: 714, x: 0, y: 0, top: 0, left: 0, right: 390, bottom: 714,
      toJSON: () => ({}),
    } as DOMRect);
    try {
      const zoom = computeFitZoom(1080, 1920);
      // width is the constraining dimension here: 390 * 0.94 / 1080
      expect(zoom).toBeCloseTo((390 * 0.94) / 1080, 5);
    } finally {
      el.remove();
    }
  });

  it('clamps tiny/zero documents to the 0.5 default', () => {
    expect(computeFitZoom(0, 1080)).toBe(0.5);
    expect(computeFitZoom(1920, 0)).toBe(0.5);
  });

  it('clamps to the supported zoom range', () => {
    const el = document.createElement('div');
    el.className = 'canvas-viewport';
    document.body.appendChild(el);
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      width: 390, height: 714, x: 0, y: 0, top: 0, left: 0, right: 390, bottom: 714,
      toJSON: () => ({}),
    } as DOMRect);
    try {
      // 1x1 px document would otherwise zoom enormously
      expect(computeFitZoom(1, 1)).toBeLessThanOrEqual(32);
    } finally {
      el.remove();
    }
  });
});
