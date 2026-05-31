// gbif-web integration layer for the omni-search FilterBuilder.
//
// FilterBuilder (see ./FilterBuilder.tsx and ./README.md) is a "search across
// fields and values" box. It emits a FilterItem ({ filterName, value,
// valueLabel, negated }) for each selection and holds no state of its own.
//
// gbif-web keeps filter state in FilterContext as
// { must: { field: value[] }, mustNot: { field: value[] } }, where range values
// are objects ({ type: 'range', value: { gte, lte } }) and existence is
// expressed with { type: 'isNotNull' } / { type: 'isNull' }.
//
// This module translates each selection into a FilterContext mutation so the
// chosen value joins the existing filters and shows up through the normal
// filter UI (buttons, chips, summaries). The catalogue in ./filterConfig.ts is
// the worked example of "how to configure it" — swap it here to retarget.

import { IdentityLabel } from '@/components/filters/displayNames';
import { rangeOrTerm } from '@/components/filters/rangeFilter';
import { FilterContext, FilterContextType, FilterType } from '@/contexts/filter';
import { useContext, useMemo } from 'react';
import { IntlShape } from 'react-intl';
import FilterBuilder from './FilterBuilder';
import { FILTER_CONFIG, FILTER_MAP } from './filterConfig';
import { useFilterHistory } from './filterHistory';
import type { FilterFieldConfig, FilterItem } from './types';

// omni-search value-types whose value string is a single value OR a "from,to"
// range. rangeOrTerm() turns these into gbif-web's range/equals value objects.
const RANGE_TYPES = new Set(['integerRange', 'geoTimeRange', 'suggestStringRange']);

// Single-value fields hold at most one value, so a new selection should replace
// the previous one rather than accumulate. Free-text (`q`) is single-value by
// nature; any other field can opt in with `singleValue: true` in its config.
function isSingleValue(cfg?: FilterFieldConfig): boolean {
  return cfg?.singleValue === true || cfg?.type === 'freeText';
}

function encodeItemValue(cfg: FilterFieldConfig | undefined, item: FilterItem): unknown {
  if (cfg && RANGE_TYPES.has(cfg.type)) {
    return rangeOrTerm(item.value, 'gte', 'lte', cfg.type === 'integerRange');
  }
  return item.value;
}

// Apply a single selection from the box to the shared FilterContext. The chosen
// value joins the existing filters and surfaces through the normal filter UI.
function applyItemToContext(filterContext: FilterContextType, item: FilterItem): void {
  const cfg = FILTER_MAP[item.filterName];
  // Existence ("has any / no value") always lives in `must` in gbif-web,
  // distinguished by isNotNull vs isNull rather than the must/mustNot bucket.
  const value =
    item.value === '*' ? { type: item.negated ? 'isNull' : 'isNotNull' } : encodeItemValue(cfg, item);
  const negated = item.value === '*' ? false : item.negated;

  if (isSingleValue(cfg)) {
    // Replace rather than append for single-value fields like `q`.
    filterContext.setField(item.filterName, [value], negated);
  } else {
    filterContext.add(item.filterName, value, negated);
  }
}

// ── gbif-web filter -> FilterItem[] (read-only, for the "Recent" shortcuts) ──

function describeValue(cfg: FilterFieldConfig, raw: any, negated: boolean): { value: string; valueLabel: string } {
  if (raw && typeof raw === 'object') {
    if (raw.type === 'isNotNull' || raw.type === 'isNull') {
      return { value: '*', valueLabel: negated ? 'has no value' : 'has any value' };
    }
    if (raw.type === 'range') {
      const { gte, lte } = raw.value ?? {};
      const value = `${gte ?? '*'},${lte ?? '*'}`;
      return { value, valueLabel: cfg.formatValue ? cfg.formatValue(value) : value };
    }
    if (raw.type === 'equals' && raw.value != null) {
      const value = String(raw.value);
      return { value, valueLabel: cfg.formatValue ? cfg.formatValue(value) : value };
    }
  }
  const value = String(raw);
  return { value, valueLabel: cfg.formatValue ? cfg.formatValue(value) : value };
}

function gbifFilterToItems(filter: FilterType | undefined): FilterItem[] {
  const items: FilterItem[] = [];
  const collect = (bucket: Record<string, any[]> | undefined, bucketNegated: boolean) => {
    Object.entries(bucket ?? {}).forEach(([filterName, values]) => {
      const cfg = FILTER_MAP[filterName];
      if (!cfg) return; // the box only knows the fields in its own catalogue
      (values ?? []).forEach((raw) => {
        const itemNegated =
          raw && typeof raw === 'object' && (raw.type === 'isNull' || raw.type === 'isNotNull')
            ? raw.type === 'isNull'
            : bucketNegated;
        const { value, valueLabel } = describeValue(cfg, raw, itemNegated);
        items.push({ filterName, filterLabel: cfg.label, value, valueLabel, negated: itemNegated });
      });
    });
  };
  collect(filter?.must, false);
  collect(filter?.mustNot, true);
  return items;
}

// ── The embeddable box ──────────────────────────────────────────────────────

export function OmniSearchBox({ className }: { className?: string }) {
  const filterContext = useContext(FilterContext);

  // The current gbif-web filter, read only to power the "Recent" shortcuts.
  const currentItems = useMemo(() => gbifFilterToItems(filterContext?.filter), [filterContext?.filter]);
  const shortcuts = useFilterHistory(currentItems);

  const handleSelect = (item: FilterItem) => {
    // Defer the context mutation out of the cmdk onSelect call stack: the
    // popover closes (unmounting the Command) first, so cmdk isn't reconciling
    // its item list during the filter-induced re-render.
    queueMicrotask(() => applyItemToContext(filterContext, item));
  };

  return (
    <FilterBuilder
      className={className}
      onSelect={handleSelect}
      filterConfig={FILTER_CONFIG}
      shortcuts={shortcuts}
      placeholder="Search by any field or value…"
      rootEntities={[
        'taxonKey',
        'basisOfRecord',
        { key: 'typeStatus', minChars: 3 },
        { key: 'establishmentMeans', minChars: 4 },
      ]}
    />
  );
}

// ── FilterSetting factory ───────────────────────────────────────────────────
//
// Returns a gbif-web FilterSetting whose Button is the search box itself. Add it
// to the occurrence search `useFilters` map under the `omniSearch` handle and
// list that handle first in `highlightedFilters` to make it the first filter.

export function createOmniSearchFilterSetting({ formatMessage }: { formatMessage: IntlShape['formatMessage'] }) {
  const name = formatMessage({ id: 'filters.omniSearch.name', defaultMessage: 'Search' });

  const Button = ({ className }: { className?: string }) => <OmniSearchBox className={className} />;
  // Reused for the mobile filter drawer, where the box is shown on its own.
  const Content = () => <OmniSearchBox />;
  const Popover = ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>;

  return {
    handle: 'omniSearch',
    name: 'filters.omniSearch.name',
    translatedFilterName: name,
    displayName: IdentityLabel,
    filterType: 'OMNI_SEARCH',
    allowNegations: true,
    allowExistence: true,
    group: 'other',
    Button,
    Content,
    Popover,
  };
}
