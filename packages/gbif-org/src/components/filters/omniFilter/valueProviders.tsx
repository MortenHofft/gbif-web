import { IntlShape } from 'react-intl';
import { LanguageOption, Config } from '@/config/config';
import { SearchMetadata } from '@/contexts/search';
import { SuggestionItem } from '@/components/filters/suggest';
import { SuggestConfig } from '@/utils/suggestEndpoints';
import { OmniFieldConfig } from './omniFilterConfig';
import { rangeOrTerm } from '@/components/filters/rangeFilter';
import { GraphQLService } from '@/services/graphQLService';
import { CANCEL_REQUEST } from '@/utils/fetchWithCancel';

// A suggestion item shown in the dropdown when the user is choosing a value.
// `predicate` is what gets added to FilterContext via `add(handle, predicate, negated)`.
// `chipLabel` is an optional display string used in the recent-filters list.
export type ValueSuggestion = {
  key: string;
  label: React.ReactNode;
  meta?: React.ReactNode;
  predicate: unknown;
  chipLabel?: string;
};

export type ValueProviderCtx = {
  intl: IntlShape;
  siteConfig: Config;
  searchContext: SearchMetadata;
  currentLocale: LanguageOption;
  checklistKey?: string;
  countrySuggest?: SuggestConfig['getSuggestions'];
};

// Fetch value suggestions for a given filter, debounced by the caller.
// Returns a cancel function so callers can abort in-flight requests.
// Any thrown error is caught and surfaced as a rejected promise so callers
// can handle it uniformly via .catch instead of needing try/catch.
export function fetchValueSuggestions(
  field: OmniFieldConfig,
  query: string,
  ctx: ValueProviderCtx
): { promise: Promise<ValueSuggestion[]>; cancel: () => void } {
  try {
    const result = fetchValueSuggestionsInner(field, query, ctx);
    return {
      promise: result.promise.then((items) => items ?? []),
      cancel: result.cancel,
    };
  } catch (err) {
    return { promise: Promise.reject(err), cancel: () => {} };
  }
}

function fetchValueSuggestionsInner(
  field: OmniFieldConfig,
  query: string,
  ctx: ValueProviderCtx
): { promise: Promise<ValueSuggestion[]>; cancel: () => void } {
  const kind = field.value;
  const q = query.trim();

  if (kind.kind === 'freeText') {
    if (!q) return { promise: Promise.resolve([]), cancel: () => {} };
    return {
      promise: Promise.resolve([
        {
          key: q,
          label: `"${q}"`,
          meta: ctx.intl.formatMessage({
            id: 'filters.q.name',
            defaultMessage: 'Free-text search',
          }),
          predicate: q,
          chipLabel: `"${q}"`,
        },
      ]),
      cancel: () => {},
    };
  }

  if (kind.kind === 'enum') {
    const lower = q.toLowerCase();
    const items = kind.options
      .map((value) => {
        const translated = kind.enumTemplate
          ? ctx.intl.formatMessage({ id: kind.enumTemplate(value), defaultMessage: value })
          : value;
        return { value, translated };
      })
      .filter(
        ({ value, translated }) =>
          !q || translated.toLowerCase().includes(lower) || value.toLowerCase().includes(lower)
      )
      .slice(0, 50)
      .map(({ value, translated }) => ({
        key: value,
        label: translated,
        meta: translated !== value ? value : null,
        predicate: value,
        chipLabel: translated,
      }));
    return { promise: Promise.resolve(items), cancel: () => {} };
  }

  if (kind.kind === 'optionalBool') {
    const lower = q.toLowerCase();
    const items = ['true', 'false']
      .filter((v) => !q || v.startsWith(lower))
      .map((value) => {
        const label = ctx.intl.formatMessage({
          id: `enums.yesNo.${value}`,
          defaultMessage: value,
        });
        return { key: value, label, predicate: value, chipLabel: label } as ValueSuggestion;
      });
    return { promise: Promise.resolve(items), cancel: () => {} };
  }

  if (kind.kind === 'range') {
    if (!q) return { promise: Promise.resolve([]), cancel: () => {} };
    const items: ValueSuggestion[] = [];
    const predicate = rangeOrTerm(q, 'gte', 'lte', true);
    if (predicate) {
      items.push({
        key: q,
        label: formatRangeLabel(q),
        meta: q,
        predicate,
        chipLabel: formatRangeLabel(q),
      });
    }
    const isInt = /^-?\d+$/.test(q);
    if (isInt) {
      const from = rangeOrTerm(`${q},`, 'gte', 'lte', true);
      const to = rangeOrTerm(`,${q}`, 'gte', 'lte', true);
      if (from) {
        items.push({
          key: `${q},`,
          label: `from ${q} onwards`,
          meta: `${q},*`,
          predicate: from,
          chipLabel: `from ${q}`,
        });
      }
      if (to) {
        items.push({
          key: `,${q}`,
          label: `up to ${q}`,
          meta: `*,${q}`,
          predicate: to,
          chipLabel: `up to ${q}`,
        });
      }
    }
    return { promise: Promise.resolve(items), cancel: () => {} };
  }

  if (kind.kind === 'wildcard') {
    if (!q) return { promise: Promise.resolve([]), cancel: () => {} };
    const hasWildcard = /[*?]/.test(q);
    const predicate = hasWildcard ? { type: 'like', value: q } : q;
    return {
      promise: Promise.resolve([
        {
          key: q,
          label: q,
          meta: hasWildcard
            ? ctx.intl.formatMessage({
                id: 'filterSupport.wildcardPattern',
                defaultMessage: 'wildcard pattern',
              })
            : null,
          predicate,
          chipLabel: q,
        },
      ]),
      cancel: () => {},
    };
  }

  if (kind.kind === 'country') {
    if (!ctx.countrySuggest) return { promise: Promise.resolve([]), cancel: () => {} };
    const { promise, cancel } = ctx.countrySuggest({
      q,
      intl: ctx.intl,
      siteConfig: ctx.siteConfig,
      searchContext: ctx.searchContext,
      locale: ctx.intl.locale,
      currentLocale: ctx.currentLocale,
    });
    return {
      promise: promise.then((items: SuggestionItem[]) =>
        items.slice(0, 20).map((item) => ({
          key: item.key,
          label: item.title,
          meta: item.key !== item.title ? item.key : null,
          predicate: item.key,
          chipLabel: item.title,
        }))
      ),
      cancel,
    };
  }

  if (kind.kind === 'suggest' || kind.kind === 'taxon') {
    // Most suggest endpoints reject empty q with a 400; bail out early.
    if (!q) return { promise: Promise.resolve([]), cancel: () => {} };
    const fn = kind.suggestConfig?.getSuggestions;
    if (!fn) return { promise: Promise.resolve([]), cancel: () => {} };
    const result = fn({
      q,
      intl: ctx.intl,
      siteConfig: ctx.siteConfig,
      searchContext: ctx.searchContext,
      locale: ctx.intl.locale,
      currentLocale: ctx.currentLocale,
      // for the taxonKey clb suggest endpoint
      checklistKey: ctx.checklistKey,
    } as any);
    return {
      promise: result.promise.then((items: SuggestionItem[]) =>
        (items ?? []).slice(0, 20).map((item) => ({
          key: String(item.key),
          label: item.title,
          meta: item.description ?? null,
          predicate: String(item.key),
          chipLabel: item.title,
        }))
      ),
      cancel: result.cancel,
    };
  }

  if (kind.kind === 'geologicalTime') {
    // Query the GraphQL geological-time vocabulary, matching the approach used
    // by gbif-web's existing geoTimeFilter. Range syntax ("Triassic,Jurassic")
    // isn't handled here — the dedicated geoTimeFilter panel covers that.
    // A picked value becomes an equals predicate.
    if (!q) return { promise: Promise.resolve([]), cancel: () => {} };
    const abortController = new AbortController();
    const graphqlService = new GraphQLService({
      endpoint: ctx.siteConfig.graphqlEndpoint,
      abortSignal: abortController.signal,
      locale: ctx.intl.locale,
    });
    const SEARCH = /* GraphQL */ `
      query OmniGeoTimeSuggest($language: String, $q: String) {
        vocabularyConceptSearch(vocabulary: "GeoTime", limit: 20, q: $q) {
          results {
            name
            uiLabel(language: $language)
          }
        }
      }
    `;
    const language = ctx.currentLocale?.vocabularyLocale ?? ctx.currentLocale?.localeCode ?? 'en';
    const promise = graphqlService
      .query<
        { vocabularyConceptSearch: { results: Array<{ name: string; uiLabel?: string }> } },
        { language: string; q: string }
      >(SEARCH, { language, q })
      .then((res) => res.json())
      .then((response): ValueSuggestion[] => {
        const results = response?.data?.vocabularyConceptSearch?.results ?? [];
        return results.map((item) => {
          const title = item.uiLabel || item.name;
          return {
            key: item.name,
            label: title,
            meta: item.name !== title ? item.name : null,
            predicate: { type: 'equals', value: item.name },
            chipLabel: title,
          };
        });
      });
    return { promise, cancel: () => abortController.abort(CANCEL_REQUEST) };
  }

  return { promise: Promise.resolve([]), cancel: () => {} };
}

function formatRangeLabel(value: string): string {
  if (!value || value === '*') return 'has any value';
  const parts = value.split(',');
  if (parts.length === 2) {
    const [from, to] = parts.map((p) => p.trim());
    if (!from && to) return `up to ${to}`;
    if (!to && from) return `from ${from}`;
    if (from && to) return `${from} – ${to}`;
  }
  return value;
}
