import { describe, expect, test } from 'vitest';
import { parseInput } from './parseInput';
import { HistoryEntry } from './useFilterHistory';
import {
  buildFilterNameItems,
  collapseToGroups,
  DropdownItem,
  getOmniFilters,
  mergeRootEntitySections,
  OmniFilterEntry,
} from './omniFilterItems';

const omniFilters: OmniFilterEntry[] = [
  { handle: 'year', label: 'Year' },
  { handle: 'basisOfRecord', label: 'Basis of record' },
  { handle: 'country', label: 'Country' },
  { handle: 'datasetKey', label: 'Dataset' },
];

const sampleHistory: HistoryEntry[] = [
  {
    handle: 'year',
    filterLabel: 'Year',
    value: 1900,
    valueLabel: '1900',
    negated: false,
  },
  {
    handle: 'basisOfRecord',
    filterLabel: 'Basis of record',
    value: 'HUMAN_OBSERVATION',
    valueLabel: 'Human observation',
    negated: false,
  },
];

const HEADINGS = {
  freeTextFallbackMeta: 'Free-text search',
  recentHeading: 'Recent',
  filtersHeading: 'Filters',
};

const ids = (items: DropdownItem[]) => items.map((i) => i.id);

describe('buildFilterNameItems', () => {
  test('empty query → all filters under "Filters" + every history entry under "Recent"', () => {
    const items = buildFilterNameItems({
      parsed: parseInput(''),
      omniFilters,
      history: sampleHistory,
      ...HEADINGS,
    });

    // sections in order: Recent, then Filters. Shortcuts then filter names.
    expect(items[0]).toMatchObject({ kind: 'section', label: 'Recent' });
    expect(items[1]).toMatchObject({ kind: 'shortcut' });
    const filtersSectionIdx = items.findIndex((i) => i.kind === 'section' && i.label === 'Filters');
    expect(filtersSectionIdx).toBeGreaterThan(0);
    expect(items.slice(filtersSectionIdx + 1).every((i) => i.kind === 'filterName')).toBe(true);
    expect(items.filter((i) => i.kind === 'filterName')).toHaveLength(omniFilters.length);
  });

  test('typed query narrows filter names and history via matchSorter/substring', () => {
    const items = buildFilterNameItems({
      parsed: parseInput('year'),
      omniFilters,
      history: sampleHistory,
      ...HEADINGS,
    });
    const names = items.filter((i) => i.kind === 'filterName').map((i: any) => i.handle);
    expect(names).toContain('year');
    const shortcuts = items.filter((i) => i.kind === 'shortcut');
    expect(shortcuts).toHaveLength(1);
    expect((shortcuts[0] as any).entry.handle).toBe('year');
  });

  test('unmatched query inserts the free-text "q" fallback', () => {
    const items = buildFilterNameItems({
      parsed: parseInput('totallyUnknownFilter'),
      omniFilters,
      history: [],
      ...HEADINGS,
    });
    // No filter matches → no Filters section, no shortcuts → only the fallback value
    expect(items).toHaveLength(1);
    const fallback = items[0];
    expect(fallback.kind).toBe('value');
    if (fallback.kind === 'value') {
      expect(fallback.handle).toBe('q');
      expect(fallback.value.predicate).toBe('totallyUnknownFilter');
      expect(fallback.value.meta).toBe('Free-text search');
    }
  });

  test('matching filter names suppress the fallback', () => {
    const items = buildFilterNameItems({
      parsed: parseInput('year'),
      omniFilters,
      history: [],
      ...HEADINGS,
    });
    expect(items.some((i) => i.kind === 'value' && i.handle === 'q')).toBe(false);
  });

  test('empty input + empty history → just the Filters section + names (no Recent header)', () => {
    const items = buildFilterNameItems({
      parsed: parseInput(''),
      omniFilters,
      history: [],
      ...HEADINGS,
    });
    expect(items[0]).toMatchObject({ kind: 'section', label: 'Filters' });
    expect(items.some((i) => i.kind === 'section' && i.label === 'Recent')).toBe(false);
  });

  test('history is filtered against handle / labels / value labels (case-insensitive)', () => {
    const history: HistoryEntry[] = [
      ...sampleHistory,
      {
        handle: 'datasetKey',
        filterLabel: 'Dataset',
        value: 'abc-123',
        valueLabel: 'My Birds Dataset',
        negated: false,
      },
    ];
    const items = buildFilterNameItems({
      parsed: parseInput('birds'),
      omniFilters,
      history,
      ...HEADINGS,
    });
    const shortcuts = items.filter((i) => i.kind === 'shortcut') as Array<
      Extract<DropdownItem, { kind: 'shortcut' }>
    >;
    expect(shortcuts).toHaveLength(1);
    expect(shortcuts[0].entry.valueLabel).toBe('My Birds Dataset');
  });

  test('shortcut id values are stable across calls (so cmdk does not lose selection)', () => {
    const a = buildFilterNameItems({
      parsed: parseInput(''),
      omniFilters,
      history: sampleHistory,
      ...HEADINGS,
    });
    const b = buildFilterNameItems({
      parsed: parseInput(''),
      omniFilters,
      history: sampleHistory,
      ...HEADINGS,
    });
    expect(ids(a)).toEqual(ids(b));
  });
});

describe('mergeRootEntitySections', () => {
  const baseItems: DropdownItem[] = [
    { kind: 'section', id: 'sec-filters', label: 'Filters' },
    { kind: 'filterName', id: 'name-year', handle: 'year', label: 'Year' },
  ];
  const filters = {
    datasetKey: { translatedFilterName: 'Dataset' } as any,
  };

  test('no root results → returns the original baseItems by reference', () => {
    const out = mergeRootEntitySections({
      baseItems,
      rootEntities: ['datasetKey'],
      sectionsByHandle: {},
      filters: filters as any,
    });
    expect(out).toBe(baseItems);
  });

  test('appends a section header per entity plus its (up to 5) value items', () => {
    const results = Array.from({ length: 8 }, (_, i) => ({
      key: `k${i}`,
      label: `L${i}`,
      predicate: `k${i}`,
    }));
    const out = mergeRootEntitySections({
      baseItems,
      rootEntities: ['datasetKey'],
      sectionsByHandle: { datasetKey: results },
      filters: filters as any,
    });
    expect(out).not.toBe(baseItems);
    expect(out.slice(0, baseItems.length)).toEqual(baseItems);
    const appended = out.slice(baseItems.length);
    expect(appended[0]).toMatchObject({
      kind: 'section',
      id: 'sec-root-datasetKey',
      label: 'Dataset',
    });
    expect(appended.slice(1)).toHaveLength(5);
    appended.slice(1).forEach((item, i) => {
      expect(item.kind).toBe('value');
      if (item.kind === 'value') {
        expect(item.handle).toBe('datasetKey');
        expect(item.sectionKey).toBe('root-datasetKey');
        expect(item.id).toBe(`root-datasetKey-${i}`);
      }
    });
  });

  test('falls back to the handle name when the filter is unknown', () => {
    const out = mergeRootEntitySections({
      baseItems,
      rootEntities: ['unregistered'],
      sectionsByHandle: { unregistered: [{ key: 'a', label: 'A', predicate: 'a' }] },
      filters: {},
    });
    const sec = out[out.length - 2];
    expect(sec).toMatchObject({ kind: 'section', label: 'unregistered' });
  });

  test('object root-entity entries are handled the same as string ones', () => {
    const out = mergeRootEntitySections({
      baseItems,
      rootEntities: [{ handle: 'datasetKey', minChars: 2 }],
      sectionsByHandle: { datasetKey: [{ key: 'k', label: 'L', predicate: 'k' }] },
      filters: filters as any,
    });
    expect(out[out.length - 2]).toMatchObject({ id: 'sec-root-datasetKey' });
  });

  test('multiple entities preserve the order of rootEntities', () => {
    const out = mergeRootEntitySections({
      baseItems,
      rootEntities: ['datasetKey', 'unregistered'],
      sectionsByHandle: {
        datasetKey: [{ key: 'a', label: 'A', predicate: 'a' }],
        unregistered: [{ key: 'b', label: 'B', predicate: 'b' }],
      },
      filters: filters as any,
    });
    const sectionLabels = out
      .filter((i) => i.kind === 'section')
      .map((i: any) => i.label);
    // base section "Filters" first, then root entities in order.
    expect(sectionLabels).toEqual(['Filters', 'Dataset', 'unregistered']);
  });
});

describe('collapseToGroups', () => {
  test('items before any section header go under a null-heading group', () => {
    const groups = collapseToGroups([
      { kind: 'filterName', id: 'a', handle: 'a', label: 'A' },
      { kind: 'filterName', id: 'b', handle: 'b', label: 'B' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].heading).toBeNull();
    expect(groups[0].items).toHaveLength(2);
  });

  test('section headers start new groups', () => {
    const groups = collapseToGroups([
      { kind: 'section', id: 's1', label: 'Recent' },
      { kind: 'filterName', id: 'a', handle: 'a', label: 'A' },
      { kind: 'section', id: 's2', label: 'Filters' },
      { kind: 'filterName', id: 'b', handle: 'b', label: 'B' },
      { kind: 'filterName', id: 'c', handle: 'c', label: 'C' },
    ]);
    expect(groups.map((g) => g.heading)).toEqual(['Recent', 'Filters']);
    expect(groups[0].items.map((i) => i.id)).toEqual(['a']);
    expect(groups[1].items.map((i) => i.id)).toEqual(['b', 'c']);
  });

  test('a section header with no following items is dropped (no empty group rendered)', () => {
    const groups = collapseToGroups([
      { kind: 'section', id: 's1', label: 'Recent' },
      { kind: 'section', id: 's2', label: 'Filters' },
      { kind: 'filterName', id: 'a', handle: 'a', label: 'A' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].heading).toBe('Filters');
  });

  test('trailing section header with no items is dropped', () => {
    const groups = collapseToGroups([
      { kind: 'section', id: 's1', label: 'A' },
      { kind: 'filterName', id: 'x', handle: 'x', label: 'X' },
      { kind: 'section', id: 's2', label: 'Empty' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].heading).toBe('A');
  });

  test('empty input → empty group list', () => {
    expect(collapseToGroups([])).toEqual([]);
  });
});

describe('getOmniFilters', () => {
  test('includes only handles that the omni config knows about', () => {
    const filters = {
      year: { handle: 'year', translatedFilterName: 'Year', group: 'g1' },
      geometry: { handle: 'geometry', translatedFilterName: 'Geometry', group: 'g1' },
      basisOfRecord: { handle: 'basisOfRecord', translatedFilterName: 'Basis', group: 'g2' },
    } as any;
    const config = { year: {}, basisOfRecord: {} };
    const out = getOmniFilters(filters, config);
    expect(out.map((o) => o.handle).sort()).toEqual(['basisOfRecord', 'year']);
    expect(out.find((o) => o.handle === 'year')).toMatchObject({ label: 'Year', group: 'g1' });
  });
});
