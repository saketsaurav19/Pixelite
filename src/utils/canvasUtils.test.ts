import { test } from 'node:test';
import assert from 'node:assert';
import { hexToRgba } from './canvasUtils.ts';

test('hexToRgba in canvasUtils converts 6-digit hex to rgba', () => {
  assert.strictEqual(hexToRgba('#ff0000', 1), 'rgba(255, 0, 0, 1)');
  assert.strictEqual(hexToRgba('#00ff00', 0.5), 'rgba(0, 255, 0, 0.5)');
});

test('hexToRgba in canvasUtils converts 3-digit shorthand hex to rgba', () => {
  assert.strictEqual(hexToRgba('#f00', 1), 'rgba(255, 0, 0, 1)');
});

test('hexToRgba in canvasUtils handles hex without # prefix', () => {
  assert.strictEqual(hexToRgba('ff0000', 1), 'rgba(255, 0, 0, 1)');
  assert.strictEqual(hexToRgba('f00', 1), 'rgba(255, 0, 0, 1)');
});
