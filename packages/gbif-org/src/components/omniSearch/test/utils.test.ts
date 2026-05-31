import { describe, it, expect } from 'vitest';
import { parseInput, getIntegerRangeSuggestions, getStringRangeSuggestions, WILDCARD_OPTION } from '../utils';

// ── parseInput ────────────────────────────────────────────────────────────────

describe('parseInput', () => {
  describe('filter_name mode (no = in input)', () => {
    it('empty string', () => {
      expect(parseInput('')).toEqual({ mode: 'filter_name', filterName: null, valueQuery: '', negated: false });
    });

    it('plain filter name', () => {
      expect(parseInput('basisOfRecord')).toEqual({
        mode: 'filter_name', filterName: null, valueQuery: 'basisOfRecord', negated: false,
      });
    });

    it('partial filter name', () => {
      expect(parseInput('bas')).toEqual({
        mode: 'filter_name', filterName: null, valueQuery: 'bas', negated: false,
      });
    });
  });

  describe('filter_value mode (= present)', () => {
    it('filter name with empty value', () => {
      expect(parseInput('basisOfRecord=')).toEqual({
        mode: 'filter_value', filterName: 'basisOfRecord', valueQuery: '', negated: false,
      });
    });

    it('filter name with value', () => {
      expect(parseInput('basisOfRecord=OBSERVATION')).toEqual({
        mode: 'filter_value', filterName: 'basisOfRecord', valueQuery: 'OBSERVATION', negated: false,
      });
    });

    it('value containing a comma is preserved whole', () => {
      expect(parseInput('year=1900,2000')).toEqual({
        mode: 'filter_value', filterName: 'year', valueQuery: '1900,2000', negated: false,
      });
    });

    it('splits only on the first = when value contains =', () => {
      expect(parseInput('year=1900=bad')).toEqual({
        mode: 'filter_value', filterName: 'year', valueQuery: '1900=bad', negated: false,
      });
    });

    it('wildcard value passes through', () => {
      expect(parseInput('year=*')).toEqual({
        mode: 'filter_value', filterName: 'year', valueQuery: '*', negated: false,
      });
    });
  });

  describe('negation with ! prefix', () => {
    it('! before filter name', () => {
      expect(parseInput('!basisOfRecord')).toEqual({
        mode: 'filter_name', filterName: null, valueQuery: 'basisOfRecord', negated: true,
      });
    });

    it('! before filter name and value', () => {
      expect(parseInput('!year=1900')).toEqual({
        mode: 'filter_value', filterName: 'year', valueQuery: '1900', negated: true,
      });
    });
  });

  describe('negation with "not " prefix', () => {
    it('lowercase "not "', () => {
      expect(parseInput('not year=1900')).toEqual({
        mode: 'filter_value', filterName: 'year', valueQuery: '1900', negated: true,
      });
    });

    it('uppercase "NOT "', () => {
      expect(parseInput('NOT year=1900')).toEqual({
        mode: 'filter_value', filterName: 'year', valueQuery: '1900', negated: true,
      });
    });

    it('"not " before filter name only', () => {
      expect(parseInput('not basisOfRecord')).toEqual({
        mode: 'filter_name', filterName: null, valueQuery: 'basisOfRecord', negated: true,
      });
    });
  });
});

// ── getIntegerRangeSuggestions ────────────────────────────────────────────────

describe('getIntegerRangeSuggestions', () => {
  it('empty query returns only wildcard', () => {
    const result = getIntegerRangeSuggestions('');
    expect(result).toEqual([WILDCARD_OPTION]);
  });

  it('4-digit number returns 4 items: exact, from, up-to, wildcard', () => {
    const result = getIntegerRangeSuggestions('1900');
    expect(result).toHaveLength(4);
    expect(result[0].value).toBe('1900');
    expect(result[1]).toMatchObject({ value: '1900,*', label: 'from 1900 onwards' });
    expect(result[2]).toMatchObject({ value: '*,1900', label: 'up to 1900' });
    expect(result[3]).toBe(WILDCARD_OPTION);
  });

  it('2-digit number also triggers from/up-to shortcuts', () => {
    const result = getIntegerRangeSuggestions('12');
    expect(result).toHaveLength(4);
    expect(result[1]).toMatchObject({ value: '12,*' });
    expect(result[2]).toMatchObject({ value: '*,12' });
  });

  it('explicit range returns exact + wildcard only (no from/to shortcuts)', () => {
    const result = getIntegerRangeSuggestions('1900,2000');
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe('1900,2000');
    expect(result[0].label).toBe('1900 – 2000');
    expect(result[1]).toBe(WILDCARD_OPTION);
  });

  it('"*,2000" is formatted as "up to 2000"', () => {
    const result = getIntegerRangeSuggestions('*,2000');
    expect(result[0]).toMatchObject({ value: '*,2000', label: 'up to 2000' });
  });

  it('"1900,*" is formatted as "from 1900"', () => {
    const result = getIntegerRangeSuggestions('1900,*');
    expect(result[0]).toMatchObject({ value: '1900,*', label: 'from 1900' });
  });

  it('non-numeric garbage returns only wildcard', () => {
    const result = getIntegerRangeSuggestions('abc');
    expect(result).toEqual([WILDCARD_OPTION]);
  });

  it('"*" input excludes literal * from suggestions but includes wildcard option', () => {
    const result = getIntegerRangeSuggestions('*');
    expect(result.every(s => s.value !== '*' || s === WILDCARD_OPTION)).toBe(true);
    expect(result).toContain(WILDCARD_OPTION);
  });

  it('appends presets after the wildcard when empty and cfg.presets is set', () => {
    const cfg: any = {
      presets: [
        { value: '0,100', label: 'Up to 100' },
        { value: '100,*', label: 'Above 100',  meta: 'high' },
      ],
    };
    const result = getIntegerRangeSuggestions('', cfg);
    expect(result[0]).toBe(WILDCARD_OPTION);
    expect(result[1]).toMatchObject({ isSectionHeader: true, label: 'Quick ranges' });
    expect(result[2]).toMatchObject({ value: '0,100', label: 'Up to 100', isPreset: true, meta: '0,100' });
    expect(result[3]).toMatchObject({ value: '100,*', label: 'Above 100', isPreset: true, meta: 'high' });
  });

  it('accepts cfg.presets as a function (evaluated each call for "now"-relative values)', () => {
    const cfg: any = { presets: () => [{ value: '2026', label: 'This year' }] };
    const result = getIntegerRangeSuggestions('', cfg);
    expect(result.find(s => s.isPreset)).toMatchObject({ value: '2026', label: 'This year' });
  });

  it('does not show presets once the user starts typing a number', () => {
    const cfg: any = { presets: [{ value: '0,100', label: 'Up to 100' }] };
    const result = getIntegerRangeSuggestions('19', cfg);
    expect(result.find(s => s.isPreset)).toBeUndefined();
    expect(result.find(s => s.isSectionHeader)).toBeUndefined();
  });
});

// ── getStringRangeSuggestions ─────────────────────────────────────────────────

describe('getStringRangeSuggestions', () => {
  it('empty query returns only wildcard', () => {
    expect(getStringRangeSuggestions([], '')).toEqual([WILDCARD_OPTION]);
  });

  it('no API results returns only wildcard', () => {
    expect(getStringRangeSuggestions([], 'cret')).toEqual([WILDCARD_OPTION]);
  });

  it('single API result gives name + from/to shortcuts + wildcard', () => {
    const result = getStringRangeSuggestions(['Cretaceous'], 'cret');
    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({ value: 'Cretaceous', label: 'Cretaceous' });
    expect(result[1]).toMatchObject({ value: 'Cretaceous,*', label: 'from Cretaceous onwards' });
    expect(result[2]).toMatchObject({ value: '*,Cretaceous', label: 'up to Cretaceous' });
    expect(result[3]).toBe(WILDCARD_OPTION);
  });

  it('multiple API results include all names; from/to shortcuts only for first', () => {
    const result = getStringRangeSuggestions(['Cretaceous', 'Early Cretaceous', 'Late Cretaceous'], 'cret');
    const values = result.map(r => r.value);
    expect(values).toContain('Cretaceous');
    expect(values).toContain('Early Cretaceous');
    expect(values).toContain('Late Cretaceous');
    expect(values).toContain('Cretaceous,*');
    expect(values).not.toContain('Early Cretaceous,*');
    expect(result[result.length - 1]).toBe(WILDCARD_OPTION);
  });

  it('range expression input returns formatted label + wildcard', () => {
    const result = getStringRangeSuggestions([], 'Jurassic,Cretaceous');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ value: 'Jurassic,Cretaceous', label: 'Jurassic – Cretaceous' });
    expect(result[1]).toBe(WILDCARD_OPTION);
  });

  it('"*,Cretaceous" is formatted as "up to Cretaceous"', () => {
    const result = getStringRangeSuggestions([], '*,Cretaceous');
    expect(result[0]).toMatchObject({ value: '*,Cretaceous', label: 'up to Cretaceous' });
  });

  it('"Cretaceous,*" is formatted as "from Cretaceous"', () => {
    const result = getStringRangeSuggestions([], 'Cretaceous,*');
    expect(result[0]).toMatchObject({ value: 'Cretaceous,*', label: 'from Cretaceous' });
  });

  it('"*" returns only wildcard', () => {
    expect(getStringRangeSuggestions([], '*')).toEqual([WILDCARD_OPTION]);
  });
});
