import { test } from 'node:test';
import assert from 'node:assert';
import { hexToRgba } from './colorUtils.ts';

test('hexToRgba converts 6-digit hex to rgba', () => {
  assert.strictEqual(hexToRgba('#ff0000', 1), 'rgba(255, 0, 0, 1)');
  assert.strictEqual(hexToRgba('#00ff00', 0.5), 'rgba(0, 255, 0, 0.5)');
  assert.strictEqual(hexToRgba('#0000ff', 0.1), 'rgba(0, 0, 255, 0.1)');
});

test('hexToRgba converts 3-digit shorthand hex to rgba', () => {
  assert.strictEqual(hexToRgba('#f00', 1), 'rgba(255, 0, 0, 1)');
  assert.strictEqual(hexToRgba('#0f0', 0.5), 'rgba(0, 255, 0, 0.5)');
});

test('hexToRgba handles hex without # prefix', () => {
  assert.strictEqual(hexToRgba('ff0000', 1), 'rgba(255, 0, 0, 1)');
  assert.strictEqual(hexToRgba('f00', 1), 'rgba(255, 0, 0, 1)');
});
