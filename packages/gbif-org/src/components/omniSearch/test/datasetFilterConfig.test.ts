import { describe, it, expect } from 'vitest';
import { DATASET_FILTER_CONFIG, DATASET_FILTER_MAP } from '../datasetFilterConfig';

const KNOWN_TYPES = ['freeText', 'boolean', 'enum', 'integerRange', 'suggestString', 'suggestStringRange', 'suggestEntity', 'vocabulary', 'geoTimeRange'];

describe('DATASET_FILTER_CONFIG', () => {
  it('is a non-empty array with no duplicate keys', () => {
    expect(Array.isArray(DATASET_FILTER_CONFIG)).toBe(true);
    expect(DATASET_FILTER_CONFIG.length).toBeGreaterThan(0);
    const keys = DATASET_FILTER_CONFIG.map(f => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('exposes only dataset-search-relevant fields', () => {
    const keys = DATASET_FILTER_CONFIG.map(f => f.key).sort();
    expect(keys).toEqual([
      'datasetKey',
      'hostingOrg',
      'publishingCountry',
      'publishingOrg',
      'q',
      'type',
    ]);
  });

  describe.each(DATASET_FILTER_CONFIG)('$key', (filter: any) => {
    it('has non-empty key, label, hint, and a recognised type', () => {
      expect(typeof filter.key).toBe('string');
      expect(filter.key.length).toBeGreaterThan(0);
      expect(typeof filter.label).toBe('string');
      expect(filter.label.length).toBeGreaterThan(0);
      expect(typeof filter.hint).toBe('string');
      expect(filter.hint.length).toBeGreaterThan(0);
      expect(KNOWN_TYPES).toContain(filter.type);
    });
  });

  it('publishingCountry enum values include {value,label} pairs', () => {
    const cfg: any = DATASET_FILTER_MAP['publishingCountry'];
    expect(cfg.type).toBe('enum');
    const dk = cfg.values.find(v => v.value === 'DK');
    expect(dk).toBeDefined();
    expect(typeof dk.label).toBe('string');
    expect(dk.label.length).toBeGreaterThan(0);
  });

  it('publishingCountry.formatValue maps a code to a friendly label', () => {
    const cfg: any = DATASET_FILTER_MAP['publishingCountry'];
    const label = cfg.formatValue('DK');
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });

  it('type enum lists the four GBIF dataset types', () => {
    const cfg = DATASET_FILTER_MAP['type'];
    expect(cfg.values).toEqual(
      expect.arrayContaining(['OCCURRENCE', 'CHECKLIST', 'METADATA', 'SAMPLING_EVENT']),
    );
  });

  it('datasetKey is a suggestEntity backed by /dataset/suggest', () => {
    const cfg = DATASET_FILTER_MAP['datasetKey'];
    expect(cfg.type).toBe('suggestEntity');
    expect(cfg.suggestUrl).toMatch(/\/dataset\/suggest$/);
    expect(typeof cfg.toSuggestion).toBe('function');
  });

  it('publisher / hosting org both use /organization/suggest', () => {
    expect(DATASET_FILTER_MAP['publishingOrg'].suggestUrl).toMatch(/\/organization\/suggest$/);
    expect(DATASET_FILTER_MAP['hostingOrg'].suggestUrl).toMatch(/\/organization\/suggest$/);
  });
});

describe('DATASET_FILTER_MAP', () => {
  it('has the same entries as DATASET_FILTER_CONFIG', () => {
    expect(Object.keys(DATASET_FILTER_MAP).length).toBe(DATASET_FILTER_CONFIG.length);
    DATASET_FILTER_CONFIG.forEach(f => expect(DATASET_FILTER_MAP[f.key]).toBe(f));
  });
});
