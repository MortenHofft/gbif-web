import { describe, expect, test } from 'vitest';
import { keyOf, stableJSON } from './useFilterHistory';

describe('stableJSON', () => {
  test('primitives match JSON.stringify', () => {
    expect(stableJSON('hello')).toBe('"hello"');
    expect(stableJSON(42)).toBe('42');
    expect(stableJSON(true)).toBe('true');
    expect(stableJSON(null)).toBe('null');
  });

  test('object keys are sorted (so order-independent equality is possible)', () => {
    expect(stableJSON({ b: 1, a: 2 })).toBe(stableJSON({ a: 2, b: 1 }));
    expect(stableJSON({ a: 1, b: 2 })).toBe('{"a":1,"b":2}');
  });

  test('nested objects are stably sorted recursively', () => {
    const left = stableJSON({ outer: { z: 1, a: 2 }, first: 3 });
    const right = stableJSON({ first: 3, outer: { a: 2, z: 1 } });
    expect(left).toBe(right);
  });

  test('arrays preserve order', () => {
    expect(stableJSON([3, 1, 2])).toBe('[3,1,2]');
    expect(stableJSON([3, 1, 2])).not.toBe(stableJSON([1, 2, 3]));
  });

  test('arrays of objects normalize each element', () => {
    expect(stableJSON([{ b: 1, a: 2 }])).toBe(stableJSON([{ a: 2, b: 1 }]));
  });
});

describe('keyOf', () => {
  test('builds handle=value form', () => {
    expect(keyOf({ handle: 'year', value: 1900, negated: false })).toBe('year=1900');
  });

  test('prefixes "!" when negated', () => {
    expect(keyOf({ handle: 'year', value: 1900, negated: true })).toBe('!year=1900');
  });

  test('object predicates are key-order independent', () => {
    const a = keyOf({ handle: 'year', value: { gte: 1900, lte: 2000 }, negated: false });
    const b = keyOf({ handle: 'year', value: { lte: 2000, gte: 1900 }, negated: false });
    expect(a).toBe(b);
  });

  test('different handles or values produce different keys (dedupe basis)', () => {
    expect(keyOf({ handle: 'year', value: 1900, negated: false })).not.toBe(
      keyOf({ handle: 'year', value: 1901, negated: false })
    );
    expect(keyOf({ handle: 'year', value: 1900, negated: false })).not.toBe(
      keyOf({ handle: 'month', value: 1900, negated: false })
    );
    expect(keyOf({ handle: 'year', value: 1900, negated: false })).not.toBe(
      keyOf({ handle: 'year', value: 1900, negated: true })
    );
  });
});
