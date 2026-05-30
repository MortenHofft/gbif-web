// gbif-web integration layer for the vendored omni-search FilterBuilder.
//
// The FilterBuilder (see ./FilterBuilder.jsx and ./README.md) is a self-contained
// "search across fields and values" box. It models its state as a flat
// FilterItem[] of { filterName, value, valueLabel, negated } and talks to the
// public GBIF suggest / vocabulary APIs directly.
//
// gbif-web instead keeps filter state in FilterContext as
// { must: { field: value[] }, mustNot: { field: value[] } }, where range values
// are objects ({ type: 'range', value: { gte, lte } }) and existence is
// expressed with { type: 'isNotNull' } / { type: 'isNull' }.
//
// This module bridges the two representations and exposes the box as a regular
// gbif-web FilterSetting so it can be dropped into the occurrence search filter
// bar (configured as the first highlighted filter). The omni-search catalogue in
// ./filterConfig.js is the worked example of "how to configure it" referenced in
// the task — swap in a different catalogue here to retarget the box.

import { useCallback, useContext, useMemo } from 'react';
import { FilterContext } from '@/contexts/filter';
import { rangeOrTerm } from '@/components/filters/rangeFilter';
import { IdentityLabel } from '@/components/filters/displayNames';
import FilterBuilder from './FilterBuilder';
import { FILTER_CONFIG, FILTER_MAP } from './filterConfig';
import { useFilterHistory } from './filterHistory';

// omni-search value-types whose value string is a single value OR a "from,to"
// range. rangeOrTerm() turns these into gbif-web's range/equals value objects.
const RANGE_TYPES = new Set(['integerRange', 'geoTimeRange', 'suggestStringRange']);

// ── gbif-web filter  →  omni-search FilterItem[] ────────────────────────────

function describeValue(cfg, raw, negated) {
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

function gbifFilterToItems(filter) {
  const items = [];
  const collect = (bucket, negated) => {
    Object.entries(bucket ?? {}).forEach(([filterName, values]) => {
      const cfg = FILTER_MAP[filterName];
      // The box only knows the fields in its own catalogue. Anything else (set
      // via another filter widget) is left untouched in the context and simply
      // not shown as a chip here.
      if (!cfg) return;
      (values ?? []).forEach((raw) => {
        // Existence always lives in `must`, with isNull meaning "has no value"
        // (the negated wildcard). Derive negation from the predicate type in
        // that case rather than from which bucket the value came from.
        const itemNegated =
          raw && typeof raw === 'object' && (raw.type === 'isNull' || raw.type === 'isNotNull')
            ? raw.type === 'isNull'
            : negated;
        const { value, valueLabel } = describeValue(cfg, raw, itemNegated);
        items.push({
          id: `${itemNegated ? '!' : ''}${filterName}=${value}`,
          filterName,
          filterLabel: cfg.label,
          value,
          valueLabel,
          negated: itemNegated,
        });
      });
    });
  };
  collect(filter?.must, false);
  collect(filter?.mustNot, true);
  return items;
}

// ── omni-search FilterItem[]  →  gbif-web filter ────────────────────────────

function encodeItemValue(cfg, item) {
  if (cfg && RANGE_TYPES.has(cfg.type)) {
    return rangeOrTerm(item.value, 'gte', 'lte', cfg.type === 'integerRange');
  }
  return item.value;
}

// Single-value fields hold at most one value, so a new selection should replace
// the previous one rather than accumulate. Free-text (`q`) is single-value by
// nature; any other field can opt in with `singleValue: true` in its config.
function isSingleValue(cfg) {
  return cfg?.singleValue === true || cfg?.type === 'freeText';
}

// Apply a single selection from the box to the shared FilterContext. The box
// itself stays empty (see NO_ITEMS below) — it only *sets* gbif-web filters,
// which then surface through the normal filter UI (buttons, chips, summaries).
function applyItemToContext(filterContext, item) {
  const cfg = FILTER_MAP[item.filterName];
  // Existence ("has any / no value") always lives in `must` in gbif-web,
  // distinguished by isNotNull vs isNull rather than the must/mustNot bucket.
  const value =
    item.value === '*'
      ? { type: item.negated ? 'isNull' : 'isNotNull' }
      : encodeItemValue(cfg, item);
  const negated = item.value === '*' ? false : item.negated;

  if (isSingleValue(cfg)) {
    // Replace rather than append for single-value fields like `q`.
    filterContext.setField(item.filterName, [value], negated);
  } else {
    filterContext.add(item.filterName, value, negated);
  }
}

// ── The embeddable box ──────────────────────────────────────────────────────

// Stable empty array: the box is always rendered "controlled, empty" so it never
// accumulates its own chips. A constant reference keeps FilterBuilder's
// value-sync effect from re-firing on every render.
const NO_ITEMS = [];

export function OmniSearchBox({ className }) {
  const filterContext = useContext(FilterContext);
  const filter = filterContext?.filter;

  // The current gbif-web filter, read only to power the "Recent" shortcuts —
  // never to render chips inside the box.
  const currentItems = useMemo(() => gbifFilterToItems(filter), [filter]);
  const shortcuts = useFilterHistory(currentItems);

  // Because value is always the empty NO_ITEMS, every onChange the box emits is a
  // freshly-applied selection (additions only — there are no chips to remove).
  // Translate each into a FilterContext mutation so it joins the existing filters.
  const handleApply = useCallback(
    (appliedItems) => {
      if (!filterContext) return;
      appliedItems.forEach((item) => applyItemToContext(filterContext, item));
    },
    [filterContext]
  );

  return (
    <div className={className} style={{ width: '100%', maxWidth: 480 }}>
      <FilterBuilder
        value={NO_ITEMS}
        onChange={handleApply}
        filterConfig={FILTER_CONFIG}
        shortcuts={shortcuts}
        showChipsInInput={false}
        showHeader={false}
        showQueryPreview={false}
        placeholder="Search by any field or value…"
        rootEntities={[
          'taxonKey',
          'basisOfRecord',
          { key: 'typeStatus', minChars: 3 },
          { key: 'establishmentMeans', minChars: 4 },
        ]}
      />
    </div>
  );
}

// ── FilterSetting factory ───────────────────────────────────────────────────
//
// Returns a gbif-web FilterSetting whose Button is the search box itself. Add it
// to the occurrence search `useFilters` map under the `omniSearch` handle and
// list that handle first in `highlightedFilters` to make it the first filter.

export function createOmniSearchFilterSetting({ formatMessage }) {
  const name = formatMessage({ id: 'filters.omniSearch.name', defaultMessage: 'Search' });

  const Button = ({ className }) => <OmniSearchBox className={className} />;
  // Reused for the mobile filter drawer, where the box is shown on its own.
  const Content = () => <OmniSearchBox />;
  const Popover = ({ trigger }) => trigger;

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
