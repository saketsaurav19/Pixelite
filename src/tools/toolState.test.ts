import { describe, it, expect } from 'vitest';
import { toolState } from './toolState.ts';

describe('toolState', () => {
  it('can store and retrieve values', () => {
    toolState.testKey = 'testValue';
    expect(toolState.testKey).toBe('testValue');
  });

  it('can delete values', () => {
    toolState.tempKey = 123;
    delete toolState.tempKey;
    expect(toolState.tempKey).toBeUndefined();
  });

  it('can store complex objects', () => {
    const obj = { x: 10, y: 20 };
    toolState.point = obj;
    expect(toolState.point).toEqual(obj);
  });
});