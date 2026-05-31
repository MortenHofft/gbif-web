import { describe, it, expect } from 'vitest';
import { formatRangeLabel, FILTER_CONFIG, FILTER_MAP } from '../filterConfig';

// ── formatRangeLabel ──────────────────────────────────────────────────────────

describe('formatRangeLabel', () => {
  it.each([
    ['*',         'has any value'],
    ['',          'has any value'],
    [null,        'has any value'],
    [undefined,   'has any value'],
    ['1900,2000', '1900 – 2000'],
    ['*,2000',    'up to 2000'],
    ['1900,*',    'from 1900'],
    ['1900',      '1900'],
    ['abc,def',   'abc – def'],
    [' 1900 , 2000 ', '1900 – 2000'],
  ])('formatRangeLabel(%s) → %s', (input, expected) => {
    expect(formatRangeLabel(input)).toBe(expected);
  });
});

// ── FILTER_CONFIG structural integrity ────────────────────────────────────────

const KNOWN_TYPES = ['freeText', 'boolean', 'enum', 'integerRange', 'suggestString', 'suggestStringRange', 'suggestEntity', 'vocabulary', 'geoTimeRange'];

describe('FILTER_CONFIG', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(FILTER_CONFIG)).toBe(true);
    expect(FILTER_CONFIG.length).toBeGreaterThan(0);
  });

  it('has no duplicate keys', () => {
    const keys = FILTER_CONFIG.map(f => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  describe.each(FILTER_CONFIG)('$key', (filter: any) => {
    it('has non-empty key, label, hint, and a recognised type', () => {
      expect(typeof filter.key).toBe('string');
      expect(filter.key.length).toBeGreaterThan(0);
      expect(typeof filter.label).toBe('string');
      expect(filter.label.length).toBeGreaterThan(0);
      expect(typeof filter.hint).toBe('string');
      expect(filter.hint.length).toBeGreaterThan(0);
      expect(KNOWN_TYPES).toContain(filter.type);
    });

    if (filter.type === 'enum') {
      it('has a non-empty values array of strings', () => {
        expect(Array.isArray(filter.values)).toBe(true);
        expect(filter.values.length).toBeGreaterThan(0);
        filter.values.forEach(v => expect(typeof v).toBe('string'));
      });
    }

    if (filter.type === 'integerRange' || filter.type === 'suggestStringRange') {
      it('has formatValue and encodeValue functions', () => {
        expect(typeof filter.formatValue).toBe('function');
        expect(typeof filter.encodeValue).toBe('function');
      });
    }

    if (filter.type === 'suggestStringRange') {
      it('has a suggestUrl starting with https://', () => {
        expect(typeof filter.suggestUrl).toBe('string');
        expect(filter.suggestUrl.startsWith('https://')).toBe(true);
      });
    }

    if (filter.type === 'suggestString') {
      it('has a suggestUrl starting with https://', () => {
        expect(typeof filter.suggestUrl).toBe('string');
        expect(filter.suggestUrl.startsWith('https://')).toBe(true);
      });
    }

    if (filter.type === 'suggestEntity') {
      it('has suggestUrl and a toSuggestion function', () => {
        expect(typeof filter.suggestUrl).toBe('string');
        expect(filter.suggestUrl.startsWith('https://')).toBe(true);
        expect(typeof filter.toSuggestion).toBe('function');
      });

      it('toSuggestion returns { value, label, meta } for a representative fixture', () => {
        const fixture = { key: 'abc-123', title: 'Test Title', name: 'Test Name', type: 'OCCURRENCE' };
        const result = filter.toSuggestion(fixture);
        expect(result).toHaveProperty('value');
        expect(result).toHaveProperty('label');
        expect(result).toHaveProperty('meta');
        expect(typeof result.value).toBe('string');
        expect(result.value.length).toBeGreaterThan(0);
      });
    }

    if (filter.type === 'vocabulary') {
      it('has a non-empty vocabulary string and a positive limit', () => {
        expect(typeof filter.vocabulary).toBe('string');
        expect(filter.vocabulary.length).toBeGreaterThan(0);
        expect(typeof filter.limit).toBe('number');
        expect(filter.limit).toBeGreaterThan(0);
      });
    }
  });
});

// ── FILTER_MAP ────────────────────────────────────────────────────────────────

describe('FILTER_MAP', () => {
  it('has the same number of entries as FILTER_CONFIG', () => {
    expect(Object.keys(FILTER_MAP).length).toBe(FILTER_CONFIG.length);
  });

  it('maps each key to the same object as in FILTER_CONFIG', () => {
    FILTER_CONFIG.forEach(filter => {
      expect(FILTER_MAP[filter.key]).toBe(filter);
    });
  });
});
