import { describe, expect, test } from 'vitest';
import { parseInput } from './parseInput';

describe('parseInput', () => {
  test('empty input → filter_name mode with empty query', () => {
    expect(parseInput('')).toEqual({
      mode: 'filter_name',
      filterName: null,
      valueQuery: '',
      negated: false,
    });
  });

  test('plain word → filter_name with that word as query', () => {
    expect(parseInput('year')).toEqual({
      mode: 'filter_name',
      filterName: null,
      valueQuery: 'year',
      negated: false,
    });
  });

  test('"handle=" → filter_value with empty query', () => {
    expect(parseInput('year=')).toEqual({
      mode: 'filter_value',
      filterName: 'year',
      valueQuery: '',
      negated: false,
    });
  });

  test('"handle=value" → filter_value with the value', () => {
    expect(parseInput('year=1900')).toEqual({
      mode: 'filter_value',
      filterName: 'year',
      valueQuery: '1900',
      negated: false,
    });
  });

  test('leading "!" toggles negated', () => {
    expect(parseInput('!year=1900')).toEqual({
      mode: 'filter_value',
      filterName: 'year',
      valueQuery: '1900',
      negated: true,
    });
  });

  test('leading "not " toggles negated (case-insensitive)', () => {
    expect(parseInput('not year')).toMatchObject({
      mode: 'filter_name',
      valueQuery: 'year',
      negated: true,
    });
    expect(parseInput('NOT year=1900')).toMatchObject({
      mode: 'filter_value',
      filterName: 'year',
      valueQuery: '1900',
      negated: true,
    });
  });

  test('handle is trimmed of whitespace', () => {
    expect(parseInput(' year = 1900')).toMatchObject({
      filterName: 'year',
      valueQuery: ' 1900',
    });
  });

  test('only the first "=" splits the input — values can contain "="', () => {
    expect(parseInput('q=a=b')).toEqual({
      mode: 'filter_value',
      filterName: 'q',
      valueQuery: 'a=b',
      negated: false,
    });
  });

  test('"!" alone gives empty negated filter_name', () => {
    expect(parseInput('!')).toEqual({
      mode: 'filter_name',
      filterName: null,
      valueQuery: '',
      negated: true,
    });
  });

  test('range-like queries are kept verbatim in valueQuery', () => {
    expect(parseInput('year=1900,2000')).toMatchObject({
      mode: 'filter_value',
      filterName: 'year',
      valueQuery: '1900,2000',
    });
  });
});
