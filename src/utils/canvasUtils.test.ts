import { test, describe } from 'node:test';
import assert from 'node:assert';
import { hexToRgba } from './canvasUtils.ts';

describe('hexToRgba', () => {
  test('should convert white 6-digit hex to rgba', () => {
    assert.strictEqual(hexToRgba('#ffffff', 1), 'rgba(255, 255, 255, 1)');
  });

  test('should convert black 6-digit hex to rgba with zero opacity', () => {
    assert.strictEqual(hexToRgba('#000000', 0), 'rgba(0, 0, 0, 0)');
  });

  test('should convert red 6-digit hex to rgba with partial opacity', () => {
    assert.strictEqual(hexToRgba('#ff0000', 0.5), 'rgba(255, 0, 0, 0.5)');
  });

  test('should convert custom 6-digit hex to rgba', () => {
    assert.strictEqual(hexToRgba('#123456', 0.123), 'rgba(18, 52, 86, 0.123)');
  });

  test('should handle uppercase 6-digit hex', () => {
    assert.strictEqual(hexToRgba('#ABCDEF', 1), 'rgba(171, 205, 239, 1)');
  });

  test('should handle 6-digit hex without # prefix', () => {
    assert.strictEqual(hexToRgba('ff0000', 1), 'rgba(255, 0, 0, 1)');
  });

  test('should handle 3-digit hex with # prefix', () => {
    assert.strictEqual(hexToRgba('#f00', 1), 'rgba(255, 0, 0, 1)');
  });

  test('should handle 3-digit hex without # prefix', () => {
    assert.strictEqual(hexToRgba('f00', 1), 'rgba(255, 0, 0, 1)');
  });

  test('should handle shorthand white', () => {
    assert.strictEqual(hexToRgba('#fff', 1), 'rgba(255, 255, 255, 1)');
  });
});
