import { IntlShape } from 'react-intl';
import { LanguageOption, Config } from '@/config/config';
import { SearchMetadata } from '@/contexts/search';
import { SuggestionItem } from '@/components/filters/suggest';
import { SuggestConfig } from '@/utils/suggestEndpoints';
import { OmniFieldConfig } from './omniFilterConfig';
import { rangeOrTerm } from '@/components/filters/rangeFilter';

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
export function fetchValueSuggestions(
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
    // Use the vocabulary endpoint to suggest geological periods. Range syntax
    // ("Triassic,Jurassic") not supported here — the dedicated geoTimeFilter
    // panel handles that. A single value just becomes an equals predicate.
    const fn = (siteConfig: Config) =>
      fetch(
        `${siteConfig.v1Endpoint}/vocabularies/GeoTime/concepts?limit=20&q=${encodeURIComponent(q)}&lang=${
          ctx.currentLocale?.vocabularyLocale ?? ctx.currentLocale?.localeCode ?? 'en'
        }`
      ).then((res) => res.json());
    const controller = new AbortController();
    const promise = fn(ctx.siteConfig).then((response: any) => {
      const results = response?.results ?? [];
      return results.slice(0, 20).map((item: any) => {
        const labels: Record<string, string> = (item.label ?? []).reduce(
          (acc: Record<string, string>, l: any) => {
            acc[l.language] = l.value;
            return acc;
          },
          {}
        );
        const locale = ctx.currentLocale?.vocabularyLocale ?? ctx.currentLocale?.localeCode ?? 'en';
        const title = labels[locale] || labels.en || item.name;
        return {
          key: item.name,
          label: title,
          meta: item.name !== title ? item.name : null,
          predicate: { type: 'equals', value: item.name },
          chipLabel: title,
        } as ValueSuggestion;
      });
    });
    return { promise, cancel: () => controller.abort() };
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
