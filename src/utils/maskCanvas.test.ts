// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

import { toGrayscaleColor } from './maskCanvas';

describe('toGrayscaleColor', () => {
  it('converts pure red to its Rec.709 luminance gray', () => {
    // 0.2126 * 255 = 54.213 -> 54
    expect(toGrayscaleColor('#ff0000')).toBe('rgb(54, 54, 54)');
  });

  it('converts white to white and black to black', () => {
    expect(toGrayscaleColor('#ffffff')).toBe('rgb(255, 255, 255)');
    expect(toGrayscaleColor('#000000')).toBe('rgb(0, 0, 0)');
  });

  it('handles 3-digit hex', () => {
    expect(toGrayscaleColor('#fff')).toBe('rgb(255, 255, 255)');
  });

  it('handles rgb() strings', () => {
    expect(toGrayscaleColor('rgb(0, 255, 0)')).toBe('rgb(182, 182, 182)');
  });

  it('passes unparseable inputs through unchanged', () => {
    expect(toGrayscaleColor('not-a-color')).toBe('not-a-color');
  });
});
