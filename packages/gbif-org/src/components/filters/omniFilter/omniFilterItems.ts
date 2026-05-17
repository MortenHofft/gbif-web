import { matchSorter } from 'match-sorter';
import { IntlShape } from 'react-intl';
import { Filters } from '../filterTools';
import { HistoryEntry, MAX_SHORTCUTS } from './useFilterHistory';
import { ParsedInput } from './parseInput';
import { ValueSuggestion } from './valueProviders';

// Items rendered in the dropdown. Three shapes flow through one list:
//   - filter-name suggestion ({ kind: 'filterName' })
//   - value suggestion       ({ kind: 'value' })
//   - shortcut from history  ({ kind: 'shortcut' })
//   - section header         ({ kind: 'section' })
export type DropdownItem =
  | {
      kind: 'filterName';
      id: string;
      handle: string;
      label: string;
    }
  | {
      kind: 'value';
      id: string;
      handle: string;
      value: ValueSuggestion;
      sectionKey?: string;
    }
  | {
      kind: 'shortcut';
      id: string;
      entry: HistoryEntry;
    }
  | { kind: 'section'; id: string; label: string };

export type OmniFilterEntry = {
  handle: string;
  label: string;
  group?: string;
};

// Build the list of dropdown items for the "filter_name" mode: recent
// shortcuts (filtered by the typed query), filter-name matches, and a
// free-text fallback when nothing matches. Pure — no React, no fetching.
export function buildFilterNameItems({
  parsed,
  omniFilters,
  history,
  freeTextFallbackMeta,
  recentHeading,
  filtersHeading,
}: {
  parsed: ParsedInput;
  omniFilters: OmniFilterEntry[];
  history: HistoryEntry[];
  freeTextFallbackMeta: string;
  recentHeading: string;
  filtersHeading: string;
}): DropdownItem[] {
  const q = parsed.valueQuery;
  const nameMatches = q ? matchSorter(omniFilters, q, { keys: ['label', 'handle'] }) : omniFilters;

  const filterNameItems: DropdownItem[] = nameMatches.map((f) => ({
    kind: 'filterName',
    id: `name-${f.handle}`,
    handle: f.handle,
    label: f.label,
  }));

  const shortcutItems: DropdownItem[] = history
    .filter((h) => {
      if (!q) return true;
      const ql = q.toLowerCase();
      return (
        h.filterLabel.toLowerCase().includes(ql) ||
        h.valueLabel.toLowerCase().includes(ql) ||
        h.handle.toLowerCase().includes(ql)
      );
    })
    .slice(0, MAX_SHORTCUTS)
    .map((h, i) => ({ kind: 'shortcut', id: `sc-${i}`, entry: h }));

  const fallback: DropdownItem[] =
    q && nameMatches.length === 0
      ? [
          {
            kind: 'value',
            id: 'q-fallback',
            handle: 'q',
            value: {
              key: q,
              label: `"${q}"`,
              meta: freeTextFallbackMeta,
              predicate: q,
              chipLabel: `"${q}"`,
            },
          },
        ]
      : [];

  const sections: DropdownItem[] = [];
  if (shortcutItems.length) {
    sections.push({ kind: 'section', id: 'sec-recent', label: recentHeading });
    sections.push(...shortcutItems);
  }
  if (filterNameItems.length) {
    sections.push({ kind: 'section', id: 'sec-filters', label: filtersHeading });
    sections.push(...filterNameItems);
  }
  sections.push(...fallback);
  return sections;
}

// Merge root-entity value suggestions into an existing dropdown list,
// adding a section header per entity. Returns a new array.
export function mergeRootEntitySections({
  baseItems,
  rootEntities,
  sectionsByHandle,
  filters,
}: {
  baseItems: DropdownItem[];
  rootEntities: Array<string | { handle: string; minChars?: number }>;
  sectionsByHandle: Record<string, ValueSuggestion[] | undefined>;
  filters: Filters;
}): DropdownItem[] {
  const extras: DropdownItem[] = [];
  for (const entry of rootEntities) {
    const handle = typeof entry === 'string' ? entry : entry.handle;
    const results = sectionsByHandle[handle];
    if (!results?.length) continue;
    const label = filters[handle]?.translatedFilterName ?? handle;
    extras.push({ kind: 'section', id: `sec-root-${handle}`, label });
    results.slice(0, 5).forEach((v, i) => {
      extras.push({
        kind: 'value',
        id: `root-${handle}-${i}`,
        handle,
        value: v,
        sectionKey: `root-${handle}`,
      });
    });
  }
  return extras.length ? [...baseItems, ...extras] : baseItems;
}

// Collapse adjacent section markers + items into cmdk-style groups,
// dropping any section that has no children (e.g. a header followed
// immediately by another header).
export function collapseToGroups(
  items: DropdownItem[]
): Array<{ heading: string | null; items: DropdownItem[] }> {
  const out: Array<{ heading: string | null; items: DropdownItem[] }> = [];
  let current: { heading: string | null; items: DropdownItem[] } = { heading: null, items: [] };
  for (const it of items) {
    if (it.kind === 'section') {
      if (current.items.length) out.push(current);
      current = { heading: it.label, items: [] };
    } else {
      current.items.push(it);
    }
  }
  if (current.items.length) out.push(current);
  return out;
}

// The list of filter handles that are eligible for the omni-filter,
// derived from the project filter map and the omni-filter config.
export function getOmniFilters(
  filters: Filters,
  omniConfig: Record<string, unknown>
): OmniFilterEntry[] {
  return Object.values(filters)
    .filter((f) => !!omniConfig[f.handle])
    .map((f) => ({
      handle: f.handle,
      label: f.translatedFilterName,
      group: f.group,
    }));
}

// Convenience used by intl.formatMessage callers in tests.
export type IntlLike = Pick<IntlShape, 'formatMessage'>;
