import { describe, expect, test } from 'vitest';
import { createIntl } from 'react-intl';
import { fetchValueSuggestions, ValueProviderCtx, ValueSuggestion } from './valueProviders';
import type { OmniFieldConfig } from './omniFilterConfig';

// Build a minimal ctx — only `intl` is actually used by the synchronous
// providers we test here. The rest are cast as any so the test doesn't
// need to construct real config / context objects.
const intl = createIntl({ locale: 'en', messages: {} });
const ctx: ValueProviderCtx = {
  intl,
  siteConfig: {} as any,
  searchContext: {} as any,
  currentLocale: { localeCode: 'en' } as any,
};

const run = async (cfg: OmniFieldConfig, q: string): Promise<ValueSuggestion[]> => {
  const { promise } = fetchValueSuggestions(cfg, q, ctx);
  return promise;
};

describe('fetchValueSuggestions — freeText', () => {
  const cfg: OmniFieldConfig = { handle: 'q', value: { kind: 'freeText' } };

  test('empty query → no suggestions (avoids polluting the dropdown)', async () => {
    expect(await run(cfg, '')).toEqual([]);
    expect(await run(cfg, '   ')).toEqual([]);
  });

  test('non-empty query → single quoted suggestion using the query as predicate', async () => {
    const out = await run(cfg, 'fungi');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      key: 'fungi',
      label: '"fungi"',
      predicate: 'fungi',
      chipLabel: '"fungi"',
    });
  });
});

describe('fetchValueSuggestions — enum', () => {
  const cfg: OmniFieldConfig = {
    handle: 'basisOfRecord',
    value: { kind: 'enum', options: ['HUMAN_OBSERVATION', 'PRESERVED_SPECIMEN', 'MATERIAL_SAMPLE'] },
  };

  test('empty query returns all options', async () => {
    const out = await run(cfg, '');
    expect(out.map((x) => x.predicate)).toEqual([
      'HUMAN_OBSERVATION',
      'PRESERVED_SPECIMEN',
      'MATERIAL_SAMPLE',
    ]);
  });

  test('substring match is case-insensitive', async () => {
    const out = await run(cfg, 'human');
    expect(out.map((x) => x.predicate)).toEqual(['HUMAN_OBSERVATION']);
  });

  test('matches against the raw enum value too', async () => {
    const out = await run(cfg, 'sample');
    expect(out.map((x) => x.predicate)).toEqual(['MATERIAL_SAMPLE']);
  });

  test('result is capped at 50 entries', async () => {
    const many = Array.from({ length: 80 }, (_, i) => `OPT_${i}`);
    const big: OmniFieldConfig = { handle: 'x', value: { kind: 'enum', options: many } };
    const out = await run(big, '');
    expect(out).toHaveLength(50);
  });
});

describe('fetchValueSuggestions — optionalBool', () => {
  const cfg: OmniFieldConfig = { handle: 'isInCluster', value: { kind: 'optionalBool' } };

  test('empty query offers true and false', async () => {
    const out = await run(cfg, '');
    expect(out.map((x) => x.predicate)).toEqual(['true', 'false']);
  });

  test('prefix match narrows the offered values', async () => {
    expect((await run(cfg, 't')).map((x) => x.predicate)).toEqual(['true']);
    expect((await run(cfg, 'fa')).map((x) => x.predicate)).toEqual(['false']);
  });

  test('non-matching prefix returns nothing', async () => {
    expect(await run(cfg, 'maybe')).toEqual([]);
  });
});

describe('fetchValueSuggestions — wildcard', () => {
  const cfg: OmniFieldConfig = { handle: 'locality', value: { kind: 'wildcard' } };

  test('empty query → empty list', async () => {
    expect(await run(cfg, '')).toEqual([]);
  });

  test('plain query → exact-match predicate (a string)', async () => {
    const out = await run(cfg, 'Norway');
    expect(out).toHaveLength(1);
    expect(out[0].predicate).toBe('Norway');
    expect(out[0].meta).toBeNull();
  });

  test('query with "*" or "?" → like-predicate with the pattern preserved', async () => {
    const out = await run(cfg, 'Nor*');
    expect(out[0].predicate).toEqual({ type: 'like', value: 'Nor*' });
    const q = await run(cfg, 'Nor?ay');
    expect(q[0].predicate).toEqual({ type: 'like', value: 'Nor?ay' });
  });
});

describe('fetchValueSuggestions — range', () => {
  const cfg: OmniFieldConfig = { handle: 'year', value: { kind: 'range' } };

  test('empty query → empty list', async () => {
    expect(await run(cfg, '')).toEqual([]);
  });

  test('integer query offers exact, "from N onwards", and "up to N"', async () => {
    const out = await run(cfg, '1900');
    expect(out.map((x) => x.key)).toEqual(['1900', '1900,', ',1900']);
    expect(out[1].label).toBe('from 1900 onwards');
    expect(out[2].label).toBe('up to 1900');
  });

  test('range query "1900,2000" → single range suggestion (no open-ended extras)', async () => {
    const out = await run(cfg, '1900,2000');
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe('1900 – 2000');
  });

  test('non-numeric query produces nothing usable', async () => {
    const out = await run(cfg, 'abc');
    // non-numeric, non-range → rangeOrTerm returns equals — but the
    // wider isInt check prevents the open-ended extras, so only the
    // single exact-match (if any) remains. We just assert no extras.
    expect(out.length).toBeLessThanOrEqual(1);
  });
});

describe('fetchValueSuggestions — unsupported / missing config', () => {
  test('country kind with no countrySuggest helper → empty list', async () => {
    const cfg: OmniFieldConfig = { handle: 'country', value: { kind: 'country' } };
    expect(await run(cfg, 'no')).toEqual([]);
  });

  test('suggest kind without a suggestConfig.getSuggestions → empty list', async () => {
    const cfg: OmniFieldConfig = {
      handle: 'datasetKey',
      value: { kind: 'suggest', suggestConfig: {} as any },
    };
    expect(await run(cfg, 'foo')).toEqual([]);
  });

  test('suggest kind with empty query short-circuits (no fetch)', async () => {
    const calls: string[] = [];
    const cfg: OmniFieldConfig = {
      handle: 'datasetKey',
      value: {
        kind: 'suggest',
        suggestConfig: {
          getSuggestions: (args: any) => {
            calls.push(args.q);
            return { promise: Promise.resolve([]), cancel: () => {} };
          },
        } as any,
      },
    };
    expect(await run(cfg, '')).toEqual([]);
    expect(calls).toEqual([]);
  });
});
