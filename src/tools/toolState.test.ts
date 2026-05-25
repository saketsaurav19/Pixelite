import { test } from 'node:test';
import assert from 'node:assert';
import { toolState } from './toolState.ts';

test('toolState can store and retrieve values', () => {
  toolState.testKey = 'testValue';
  assert.strictEqual(toolState.testKey, 'testValue');
});

test('toolState can delete values', () => {
  toolState.tempKey = 123;
  delete toolState.tempKey;
  assert.strictEqual(toolState.tempKey, undefined);
});

test('toolState can store complex objects', () => {
  const obj = { x: 10, y: 20 };
  toolState.point = obj;
  assert.deepStrictEqual(toolState.point, obj);
});
