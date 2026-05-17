import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createIntl } from 'react-intl';
import { fetchValueSuggestions, ValueProviderCtx } from './valueProviders';
import { typeStatusSuggest } from '@/utils/suggestEndpoints';
import type { OmniFieldConfig } from './omniFilterConfig';

// Both providers under test ultimately hit `global.fetch`:
//   - typeStatus → vocabularySuggest('TypeStatus') → fetchWithCancel → fetch(v1Endpoint)
//   - geologicalTime → new GraphQLService(...).query → fetch(graphqlEndpoint)
// We swap fetch with a vi.fn that returns a Response shape and assert
// both that the provider transforms the payload correctly and that the
// URL it called carries the expected query.

const intl = createIntl({ locale: 'en', messages: {} });

const baseCtx: ValueProviderCtx = {
  intl,
  siteConfig: {
    v1Endpoint: 'https://api.example.test/v1',
    graphqlEndpoint: 'https://api.example.test/graphql',
  } as any,
  searchContext: {} as any,
  currentLocale: { localeCode: 'en', vocabularyLocale: 'en' } as any,
};

const jsonResponse = (body: unknown): Response =>
  ({
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response);

let fetchMock: ReturnType<typeof vi.fn>;
let originalFetch: typeof fetch | undefined;

beforeEach(() => {
  fetchMock = vi.fn();
  originalFetch = globalThis.fetch;
  // @ts-expect-error overriding the global for the test
  globalThis.fetch = fetchMock;
});

afterEach(() => {
  // @ts-expect-error restoring the global
  globalThis.fetch = originalFetch;
});

describe('fetchValueSuggestions — typeStatus (vocabulary suggest)', () => {
  // typeStatusSuggest is the same suggestConfig that OMNI_FILTER_CONFIG.typeStatus uses.
  // We mount it on a minimal OmniFieldConfig so the test doesn't need to import
  // OMNI_FILTER_CONFIG (which transitively loads the entire filter UI graph).
  const cfg: OmniFieldConfig = {
    handle: 'typeStatus',
    value: { kind: 'suggest', suggestConfig: typeStatusSuggest as any },
  };

  test('empty query short-circuits before fetching (avoids 400 on empty q)', async () => {
    const { promise } = fetchValueSuggestions(cfg, '', baseCtx);
    expect(await promise).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('non-empty query hits the vocabulary endpoint and maps results', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        results: [
          {
            name: 'HOLOTYPE',
            label: [{ language: 'en', value: 'Holotype' }],
          },
          {
            name: 'PARATYPE',
            label: [{ language: 'en', value: 'Paratype' }],
          },
        ],
      })
    );

    const { promise } = fetchValueSuggestions(cfg, 'type', baseCtx);
    const out = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/vocabularies/TypeStatus/concepts');
    expect(calledUrl).toContain('q=type');
    expect(calledUrl).toContain('lang=en');

    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      key: 'HOLOTYPE',
      label: 'Holotype',
      predicate: 'HOLOTYPE',
      chipLabel: 'Holotype',
    });
    expect(out[1]).toMatchObject({
      key: 'PARATYPE',
      label: 'Paratype',
      predicate: 'PARATYPE',
    });
  });

  test('falls back to the concept name when no label is present in the active locale', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        results: [
          {
            name: 'LECTOTYPE',
            // only a non-en label
            label: [{ language: 'es', value: 'Lectotipo' }],
          },
        ],
      })
    );
    const { promise } = fetchValueSuggestions(cfg, 'lect', baseCtx);
    const out = await promise;
    // vocabularySuggest's extractTitle picks labels[en] || result.name → 'LECTOTYPE'
    expect(out[0].label).toBe('LECTOTYPE');
  });

  test('caps results at 20 even if the endpoint returns more', async () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      name: `T_${i}`,
      label: [{ language: 'en', value: `Type ${i}` }],
    }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ results: many }));

    const { promise } = fetchValueSuggestions(cfg, 't', baseCtx);
    const out = await promise;
    expect(out).toHaveLength(20);
  });

  test('cancel() is exposed and can be called without throwing', async () => {
    // The cancel function on a never-resolving fetch should be safe to call.
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));
    const { promise, cancel } = fetchValueSuggestions(cfg, 'foo', baseCtx);
    expect(() => cancel()).not.toThrow();
    // Don't await the never-resolving promise — just confirm a Promise was returned.
    expect(promise).toBeInstanceOf(Promise);
  });
});

describe('fetchValueSuggestions — geologicalTime (GraphQL vocabulary)', () => {
  const cfg: OmniFieldConfig = {
    handle: 'geologicalTime',
    value: { kind: 'geologicalTime' },
  };

  test('empty query short-circuits before any GraphQL call', async () => {
    const { promise } = fetchValueSuggestions(cfg, '', baseCtx);
    expect(await promise).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('non-empty query queries the GraphQL endpoint and maps concept results', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          vocabularyConceptSearch: {
            results: [
              { name: 'Jurassic', uiLabel: 'Jurassic' },
              { name: 'Triassic', uiLabel: 'Triassic period' },
            ],
          },
        },
      })
    );

    const { promise } = fetchValueSuggestions(cfg, 'jur', baseCtx);
    const out = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    // GraphQLService issues a GET against the configured endpoint
    expect(calledUrl).toMatch(/^https:\/\/api\.example\.test\/graphql\?/);

    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      key: 'Jurassic',
      label: 'Jurassic',
      predicate: { type: 'equals', value: 'Jurassic' },
      chipLabel: 'Jurassic',
    });
    // uiLabel differs from name → name is surfaced in `meta`
    expect(out[1]).toMatchObject({
      key: 'Triassic',
      label: 'Triassic period',
      meta: 'Triassic',
    });
  });

  test('missing uiLabel falls back to the concept name', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          vocabularyConceptSearch: {
            results: [{ name: 'Cambrian' }],
          },
        },
      })
    );
    const { promise } = fetchValueSuggestions(cfg, 'cam', baseCtx);
    const out = await promise;
    expect(out[0].label).toBe('Cambrian');
    // when label === name, no extra meta is shown
    expect(out[0].meta).toBeNull();
  });

  test('empty GraphQL results → empty list (no errors)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: { vocabularyConceptSearch: { results: [] } } })
    );
    const { promise } = fetchValueSuggestions(cfg, 'xyz', baseCtx);
    expect(await promise).toEqual([]);
  });

  test('cancel() aborts the underlying fetch via AbortController', async () => {
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });
    const { promise, cancel } = fetchValueSuggestions(cfg, 'jur', baseCtx);
    cancel();
    await expect(promise).rejects.toThrow();
  });
});
