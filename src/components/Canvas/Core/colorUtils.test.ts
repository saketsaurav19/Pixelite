import { describe, it, expect } from 'vitest';
import { hexToRgba } from './colorUtils.ts';

describe('hexToRgba in colorUtils', () => {
  it('converts 6-digit hex to rgba', () => {
    expect(hexToRgba('#ff0000', 1)).toBe('rgba(255, 0, 0, 1)');
    expect(hexToRgba('#00ff00', 0.5)).toBe('rgba(0, 255, 0, 0.5)');
    expect(hexToRgba('#0000ff', 0.1)).toBe('rgba(0, 0, 255, 0.1)');
  });

  it('converts 3-digit shorthand hex to rgba', () => {
    expect(hexToRgba('#f00', 1)).toBe('rgba(255, 0, 0, 1)');
    expect(hexToRgba('#0f0', 0.5)).toBe('rgba(0, 255, 0, 0.5)');
  });

  it('handles hex without # prefix', () => {
    expect(hexToRgba('ff0000', 1)).toBe('rgba(255, 0, 0, 1)');
    expect(hexToRgba('f00', 1)).toBe('rgba(255, 0, 0, 1)');
  });
});