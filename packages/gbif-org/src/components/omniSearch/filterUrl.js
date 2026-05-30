import { FILTER_MAP } from './filterConfig';

/**
 * Serialize a filter array to a URL query string (no leading ?).
 * Inverse of queryToFilters.
 */
export function filtersToQuery(filters, filterMap = FILTER_MAP) {
  if (!filters.length) return '';
  return filters
    .map(f => {
      const cfg = filterMap[f.filterName];
      const enc = cfg?.encodeValue
        ? cfg.encodeValue(f.value)
        : encodeURIComponent(f.value);
      return `${f.negated ? '!' : ''}${encodeURIComponent(f.filterName)}=${enc}`;
    })
    .join('&');
}

function syncLabel(cfg, value, negated) {
  if (value === '*') return negated ? 'has no value' : 'has any value';
  return cfg?.formatValue?.(value) ?? value;
}

/**
 * Parse a URL query string into a filter array, resolving display labels.
 * suggestEntity filters with a resolveLabel function make an async fetch;
 * all other types derive their label synchronously.
 *
 * Unknown filter keys are silently dropped.
 */
export async function queryToFilters(search, filterMap = FILTER_MAP) {
  const entries = [...new URLSearchParams(search).entries()];

  const resolved = await Promise.all(
    entries.map(async ([rawKey, value]) => {
      const negated = rawKey.startsWith('!');
      const filterName = negated ? rawKey.slice(1) : rawKey;
      const cfg = filterMap[filterName];
      if (!cfg) return null;

      let valueLabel;
      if (cfg.type === 'suggestEntity' && value !== '*' && cfg.resolveLabel) {
        try { valueLabel = await cfg.resolveLabel(value); }
        catch { valueLabel = value; }
      } else {
        valueLabel = syncLabel(cfg, value, negated);
      }

      return {
        id:          crypto.randomUUID(),
        filterName,
        filterLabel: cfg.label,
        value,
        valueLabel,
        negated,
      };
    }),
  );

  return resolved.filter(Boolean);
}
