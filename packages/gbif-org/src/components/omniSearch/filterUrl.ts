import { FILTER_MAP } from './filterConfig';
import type { FilterFieldConfig, FilterItem } from './types';

/**
 * Serialize a filter array to a URL query string (no leading ?).
 * Inverse of queryToFilters.
 */
export function filtersToQuery(
  filters: FilterItem[],
  filterMap: Record<string, FilterFieldConfig> = FILTER_MAP
): string {
  if (!filters.length) return '';
  return filters
    .map((f) => {
      const cfg = filterMap[f.filterName];
      const enc = cfg?.encodeValue ? cfg.encodeValue(f.value) : encodeURIComponent(f.value);
      return `${f.negated ? '!' : ''}${encodeURIComponent(f.filterName)}=${enc}`;
    })
    .join('&');
}

function syncLabel(cfg: FilterFieldConfig | undefined, value: string, negated: boolean): string {
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
export async function queryToFilters(
  search: string,
  filterMap: Record<string, FilterFieldConfig> = FILTER_MAP
): Promise<FilterItem[]> {
  const entries = [...new URLSearchParams(search).entries()];

  const resolved = await Promise.all(
    entries.map(async ([rawKey, value]): Promise<FilterItem | null> => {
      const negated = rawKey.startsWith('!');
      const filterName = negated ? rawKey.slice(1) : rawKey;
      const cfg = filterMap[filterName];
      if (!cfg) return null;

      let valueLabel: string;
      if (cfg.type === 'suggestEntity' && value !== '*' && cfg.resolveLabel) {
        try {
          valueLabel = await cfg.resolveLabel(value);
        } catch {
          valueLabel = value;
        }
      } else {
        valueLabel = syncLabel(cfg, value, negated);
      }

      return {
        filterName,
        filterLabel: cfg.label,
        value,
        valueLabel,
        negated,
      };
    })
  );

  return resolved.filter((x): x is FilterItem => x !== null);
}
