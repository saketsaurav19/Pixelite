import assert from 'node:assert';
import test from 'node:test';
import { formatToolName } from './stringUtils.ts';

test('formatToolName formats tool IDs correctly', () => {
  assert.strictEqual(formatToolName('brush'), 'Brush');
  assert.strictEqual(formatToolName('art_history_brush'), 'Art History Brush');
  assert.strictEqual(formatToolName('rect_shape'), 'Rect Shape');
  assert.strictEqual(formatToolName('magic_wand'), 'Magic Wand');
});

test('formatToolName uses cache', () => {
  const start = performance.now();
  for (let i = 0; i < 100000; i++) {
    formatToolName('art_history_brush');
  }
  const end = performance.now();
  console.log(`Time for 100,000 calls: ${end - start}ms`);
  assert.ok(end - start < 100, 'Caching should be fast');
});
