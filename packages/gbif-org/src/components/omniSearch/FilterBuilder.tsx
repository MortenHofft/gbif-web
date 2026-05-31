import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/utils/shadcn';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MdSearch } from 'react-icons/md';
import { FILTER_CONFIG as DEFAULT_FILTER_CONFIG, GBIF_GRAPHQL_URL } from './filterConfig';
import {
  WILDCARD_OPTION,
  getGeoTimeRangeSuggestions,
  getIntegerRangeSuggestions,
  getStringRangeSuggestions,
  parseInput,
} from './utils';
import type { EnumValue, FilterFieldConfig, FilterItem, RootEntity, Shortcut, Suggestion } from './types';

// ── Data fetching ─────────────────────────────────────────────────────────────

// Normalise enum values: support either a bare string list or
// [{value, label}] for filters that want friendlier display text
// (e.g. ISO country code → country name).
function normaliseEnumValue(v: EnumValue): { value: string; label: string } {
  return typeof v === 'string' ? { value: v, label: v } : v;
}

async function fetchValueSuggestions(cfg: FilterFieldConfig, query: string): Promise<Suggestion[]> {
  if (cfg.type === 'integerRange') return getIntegerRangeSuggestions(query, cfg);

  if (cfg.type === 'geoTimeRange') return getGeoTimeRangeSuggestions(query);

  if (cfg.type === 'freeText') {
    if (!query.trim()) return [WILDCARD_OPTION];
    return [{ value: query, label: `"${query}"`, meta: 'Fuzzy match across all indexed fields' }];
  }

  if (cfg.type === 'suggestStringRange') {
    const q = query.trim();
    if (!q || q.includes(',') || q === '*') return getStringRangeSuggestions([], q);
    const url = `${cfg.suggestUrl}?limit=10&q=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return getStringRangeSuggestions(Array.isArray(data) ? data : [], q);
  }

  if (query === '*') return [WILDCARD_OPTION];

  if (cfg.type === 'boolean') {
    const options: Suggestion[] = [
      { value: 'true', label: 'true', meta: null },
      { value: 'false', label: 'false', meta: null },
    ];
    const q = query.toLowerCase();
    const filtered = q ? options.filter((o) => o.value.startsWith(q)) : options;
    return [WILDCARD_OPTION, ...filtered];
  }

  if (cfg.type === 'enum') {
    const q = query.toLowerCase();
    const results: Suggestion[] = (cfg.values ?? [])
      .map(normaliseEnumValue)
      .filter((v) => !q || v.value.toLowerCase().includes(q) || v.label.toLowerCase().includes(q))
      .map((v) => ({
        value: v.value,
        label: v.label,
        meta: v.value !== v.label ? v.value : null,
      }));
    return query ? results : [WILDCARD_OPTION, ...results];
  }

  if (cfg.type === 'suggestString' || cfg.type === 'suggestEntity') {
    if (!query.trim()) return [WILDCARD_OPTION];
    const url = `${cfg.suggestUrl}?limit=20&q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.results ?? []);
    if (cfg.type === 'suggestEntity' && cfg.toSuggestion) return items.map(cfg.toSuggestion);

    const apiSuggs: Suggestion[] = items.map((name: string) => ({ value: name, label: name, meta: null }));
    if (cfg.wildcardPattern && /[?*]/.test(query)) {
      return [
        { value: query, label: query, meta: 'wildcard pattern', isPatternValue: true },
        ...apiSuggs.filter((s) => s.value !== query),
        WILDCARD_OPTION,
      ];
    }
    return apiSuggs;
  }

  if (cfg.type === 'vocabulary') {
    const res = await fetch(GBIF_GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query {
          vocabularyConceptSearch(vocabulary: "${cfg.vocabulary}", limit: ${cfg.limit ?? 10}, q: ${JSON.stringify(query)}) {
            results { name uiLabel }
          }
        }`,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { data } = await res.json();
    const results: Suggestion[] = (data?.vocabularyConceptSearch?.results ?? []).map((r: any) => ({
      value: r.name,
      label: r.uiLabel ?? r.name,
      meta: r.uiLabel && r.name !== r.uiLabel ? r.name : null,
    }));
    // The vocab API matches against alt labels and definitions too (e.g. "holoty"
    // returns isotype/neotype because their definitions mention holotype) — filter
    // client-side to keep only items where the query appears in the name or label.
    const q = query.trim();
    if (!q) return [WILDCARD_OPTION, ...results];
    const ql = q.toLowerCase();
    return results.filter((r) => r.value.toLowerCase().includes(ql) || r.label.toLowerCase().includes(ql));
  }

  return [];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Partition suggestions into groups separated by section-header entries so we
// can render them as <CommandGroup> blocks. Items appearing before any header
// form an initial group with no heading.
function groupSuggestions(suggestions: Suggestion[]): { heading: string | null; items: Suggestion[] }[] {
  const groups: { heading: string | null; items: Suggestion[] }[] = [];
  let current: { heading: string | null; items: Suggestion[] } = { heading: null, items: [] };
  for (const s of suggestions) {
    if (s.isSectionHeader) {
      if (current.items.length) groups.push(current);
      current = { heading: s.label, items: [] };
    } else {
      current.items.push(s);
    }
  }
  if (current.items.length) groups.push(current);
  return groups;
}

function highlight(text: string, query: string): React.ReactNode {
  if (!text || !query) return text ?? '';
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong className="g-text-primary-600 g-font-semibold">{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export type FilterBuilderProps = {
  // Fired once per applied suggestion. The host turns the item into a filter.
  onSelect: (item: FilterItem) => void;
  filterConfig?: FilterFieldConfig[];
  rootEntities?: RootEntity[];
  shortcuts?: Shortcut[];
  placeholder?: string;
  className?: string;
};

/**
 * A single search box to compose filters by field and value. Renders as an
 * input-styled trigger in the filter bar that opens a cmdk popover (matching
 * gbif-web's other filters). It does not hold any state of its own — each
 * selection is emitted via `onSelect`, leaving the host to apply it.
 */
export default function FilterBuilder({
  onSelect,
  filterConfig = DEFAULT_FILTER_CONFIG,
  rootEntities = ['taxonKey'],
  shortcuts = [],
  placeholder = 'Search filters…',
  className,
}: FilterBuilderProps) {
  const filterMap = useMemo(
    () => Object.fromEntries(filterConfig.map((f) => [f.key, f])),
    [filterConfig]
  );

  const [open, setOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const rootQueryRef = useRef('');
  const entityResultsRef = useRef<Record<string, { cfg: FilterFieldConfig; suggs: Suggestion[]; error?: boolean }>>({});

  const parsed = useMemo(() => parseInput(inputText), [inputText]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const filterCfg = parsed.filterName ? filterMap[parsed.filterName] : undefined;
    const isApiCall =
      parsed.mode === 'filter_value' &&
      !!filterCfg &&
      ['suggestString', 'suggestEntity', 'vocabulary', 'suggestStringRange', 'geoTimeRange'].includes(
        filterCfg.type
      );

    // Switching into filter_value mode with an API-backed type: replace any
    // stale items with just the wildcard so the dropdown isn't misleading
    // while we wait.
    if (isApiCall) {
      setSuggestions([WILDCARD_OPTION]);
      setIsLoading(true);
    }

    debounceRef.current = setTimeout(async () => {
      if (parsed.mode === 'filter_name') {
        const q = parsed.valueQuery.toLowerCase();
        const filterText = parsed.valueQuery.trim();

        // Generous matching: substring on key, label, or any alias, ranked so
        // that prefix matches surface ahead of mid-string matches.
        const score = (f: FilterFieldConfig): number => {
          const key = f.key.toLowerCase();
          const label = f.label.toLowerCase();
          const aliases = (f.aliases ?? []).map((a) => a.toLowerCase());
          if (key.startsWith(q)) return 3;
          if (label.startsWith(q)) return 2;
          if (aliases.some((a) => a.startsWith(q))) return 2;
          if (key.includes(q)) return 1;
          if (label.includes(q)) return 0;
          if (aliases.some((a) => a.includes(q))) return 0;
          return -1;
        };
        // When the user has typed `!` / `not `, only fields that opt in to
        // negation may appear.
        const negationOk = (f: FilterFieldConfig) => !parsed.negated || f.supportsNegation !== false;
        const matches = filterText
          ? filterConfig
              .filter((f) => f.key !== 'q' && negationOk(f))
              .map((f) => ({ f, s: score(f) }))
              .filter((x) => x.s >= 0)
              .sort((a, b) => b.s - a.s)
              .map((x) => x.f)
          : filterConfig.filter((f) => f.key !== 'q' && negationOk(f));
        const nameSuggestions: Suggestion[] = matches.map((f) => ({
          value: f.key,
          label: f.label,
          meta: f.hint,
          isFilterName: true,
        }));
        // Free-text fallback is always non-negated (`q` doesn't sensibly
        // support negation), so hide it whenever the user typed `!`.
        const textOption: Suggestion[] =
          filterText && !parsed.negated && filterMap['q']
            ? [
                {
                  value: filterText,
                  label: `"${filterText}"`,
                  meta: 'Free-text search across all fields · param: q',
                  isQuickText: true,
                },
              ]
            : [];

        // Shortcuts: previously-applied filters.
        const shortcutSuggs: Suggestion[] = shortcuts
          .filter((sc) => !parsed.negated || sc.negated)
          .filter(
            (sc) =>
              !filterText ||
              sc.filterName.toLowerCase().includes(q) ||
              sc.filterLabel?.toLowerCase().includes(q) ||
              sc.valueLabel?.toLowerCase().includes(q)
          )
          .map((sc) => ({
            value: `__sc_${sc.filterName}_${sc.value}`,
            label: `${sc.filterLabel}: ${sc.valueLabel}`,
            meta: sc.negated ? `NOT ${sc.filterName}` : sc.filterName,
            isShortcut: true,
            shortcut: sc,
          }));

        // Phase 1: show filter names + shortcuts immediately (no network).
        const phase1: Suggestion[] = shortcutSuggs.length
          ? [
              { isSectionHeader: true, label: 'Recent', value: '__sec_recent' },
              ...shortcutSuggs,
              ...(nameSuggestions.length
                ? [{ isSectionHeader: true, label: 'Filters', value: '__sec_filters' }, ...nameSuggestions]
                : []),
              ...textOption,
            ]
          : [...nameSuggestions, ...textOption];
        setSuggestions(phase1);

        // Phase 2: fetch inline suggestions for each configured root entity
        // (taxa, basisOfRecord, etc.) and splice them in as sections.
        if (filterText && rootEntities.length && !parsed.negated) {
          rootQueryRef.current = filterText;
          entityResultsRef.current = {};
          const rebuild = () => {
            const accumulated = entityResultsRef.current;
            const sections = rootEntities
              .map((e) => (typeof e === 'string' ? e : e.key))
              .filter((k) => accumulated[k])
              .map((k) => ({ key: k, ...accumulated[k] }));
            if (!sections.length) return;
            const combined: Suggestion[] = [
              ...(shortcutSuggs.length
                ? [{ isSectionHeader: true, label: 'Recent', value: '__sec_recent' } as Suggestion, ...shortcutSuggs]
                : []),
              ...(nameSuggestions.length
                ? [{ isSectionHeader: true, label: 'Filters', value: '__sec_filters' } as Suggestion, ...nameSuggestions]
                : []),
              ...sections.flatMap((section) => [
                { isSectionHeader: true, label: section.cfg.label, value: `__sec_${section.key}` } as Suggestion,
                ...(section.error
                  ? [
                      {
                        value: `__err_${section.key}`,
                        label: `Failed to load ${section.cfg.label} suggestions`,
                        meta: 'API error',
                        disabled: true,
                      } as Suggestion,
                    ]
                  : section.suggs),
              ]),
              ...textOption,
            ];
            setSuggestions(combined);
          };
          rootEntities.forEach(async (entry) => {
            const { key, minChars = 1 } = typeof entry === 'string' ? { key: entry, minChars: 1 } : entry;
            if (filterText.length < minChars) return;
            const cfg = filterMap[key];
            if (!cfg) return;
            try {
              const raw = await fetchValueSuggestions(cfg, filterText);
              if (rootQueryRef.current !== filterText) return;
              const suggs = raw
                .filter((s) => !s.isWildcard && !s.disabled && s.value && s.label)
                .slice(0, 5)
                .map((s) => ({ ...s, isRootEntitySuggestion: true, entityKey: key }));
              if (!suggs.length) return;
              entityResultsRef.current[key] = { cfg, suggs };
              rebuild();
            } catch {
              if (rootQueryRef.current !== filterText) return;
              entityResultsRef.current[key] = { cfg, suggs: [], error: true };
              rebuild();
            }
          });
        }
        return;
      }

      // Entering filter_value mode — cancel any pending root-entity fetch
      rootQueryRef.current = '';

      if (!filterCfg) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const raw = await fetchValueSuggestions(filterCfg, parsed.valueQuery);
        // Some backends have no exists/has-value predicate. Strip the wildcard
        // option for those fields so it can't be selected.
        const suggs = filterCfg.supportsExistence === false ? raw.filter((s) => !s.isWildcard) : raw;
        setSuggestions(suggs);
      } catch {
        const errorRows: Suggestion[] = [
          { value: '__err', label: 'Failed to load suggestions', meta: 'API error', disabled: true },
        ];
        setSuggestions(filterCfg.supportsExistence === false ? errorRows : [WILDCARD_OPTION, ...errorRows]);
      } finally {
        setIsLoading(false);
      }
    }, isApiCall ? 280 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputText]);

  const reset = useCallback(() => {
    setInputText('');
    setOpen(false);
  }, []);

  const applySuggestion = useCallback(
    (s: Suggestion) => {
      if (s.disabled || s.isSectionHeader) return;

      if (s.isFilterName) {
        setInputText((parsed.negated ? '!' : '') + s.value + '=');
        inputRef.current?.focus();
        return;
      }
      if (s.extendRange) {
        setInputText(`${parsed.negated ? '!' : ''}${parsed.filterName}=${s.value},`);
        inputRef.current?.focus();
        return;
      }
      if (s.isShortcut && s.shortcut) {
        const sc = s.shortcut;
        onSelect({
          filterName: sc.filterName,
          filterLabel: sc.filterLabel,
          value: sc.value,
          valueLabel: sc.valueLabel,
          negated: !!sc.negated,
        });
        reset();
        return;
      }
      if (s.isRootEntitySuggestion && s.entityKey) {
        const cfg = filterMap[s.entityKey];
        onSelect({
          filterName: s.entityKey,
          filterLabel: cfg?.label ?? s.entityKey,
          value: s.value,
          valueLabel: cfg?.formatValue?.(s.value) ?? s.chipLabel ?? s.label,
          negated: parsed.negated,
        });
        reset();
        return;
      }
      if (s.isQuickText) {
        const cfg = filterMap['q'];
        onSelect({
          filterName: 'q',
          filterLabel: cfg?.label ?? 'Text Search',
          value: s.value,
          valueLabel: `"${s.value}"`,
          negated: false,
        });
        reset();
        return;
      }
      // a value for the current field
      const cfg = parsed.filterName ? filterMap[parsed.filterName] : undefined;
      onSelect({
        filterName: parsed.filterName ?? '',
        filterLabel: cfg?.label ?? parsed.filterName ?? '',
        value: s.value,
        valueLabel: s.isWildcard
          ? parsed.negated
            ? 'has no value'
            : 'has any value'
          : cfg?.formatValue?.(s.value) ?? s.chipLabel ?? s.label,
        negated: parsed.negated,
      });
      reset();
    },
    [parsed.filterName, parsed.negated, filterMap, onSelect, reset]
  );

  const groups = useMemo(() => groupSuggestions(suggestions), [suggestions]);

  // Header shown above the list: mode on the start, negation info end-aligned.
  const headerStart =
    parsed.mode === 'filter_value' ? (
      <>
        Values for <span className="g-font-medium g-text-slate-700">{parsed.filterName}</span>
      </>
    ) : (
      'Filter fields'
    );
  const headerEnd = parsed.negated ? (
    <span className="g-text-red-600 g-font-semibold">negated (!)</span>
  ) : (
    <span className="g-text-slate-400">
      prefix <span className="g-font-mono">!</span> to negate
    </span>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'g-inline-flex g-items-center g-gap-2 g-h-9 g-min-w-48 g-max-w-full g-rounded-md g-border g-border-slate-300 g-bg-white g-px-3 g-text-sm g-text-slate-500 g-transition-colors hover:g-border-slate-400 focus:g-outline-none focus-visible:g-ring-2 focus-visible:g-ring-primary-500',
            className
          )}
        >
          <MdSearch className="g-text-base g-text-slate-400 g-shrink-0" />
          <span className="g-truncate">{placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="g-w-[420px] g-max-w-[var(--radix-popper-available-width)] g-p-0 g-overflow-hidden"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <Command
          shouldFilter={false}
          loop
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              const selected = e.currentTarget.querySelector(
                '[cmdk-item=""][data-selected="true"]'
              ) as HTMLElement | null;
              if (selected) {
                e.preventDefault();
                selected.click();
              }
            }
          }}
        >
          <CommandInput
            ref={inputRef}
            value={inputText}
            onValueChange={setInputText}
            placeholder={placeholder}
          />
          <div className="g-flex g-items-center g-justify-between g-gap-2 g-px-3 g-py-1.5 g-text-[11px] g-uppercase g-tracking-wide g-text-slate-400 g-border-b g-bg-slate-50">
            <span>{headerStart}</span>
            <span className="g-normal-case g-tracking-normal">{isLoading ? 'loading…' : headerEnd}</span>
          </div>
          <CommandList data-testid="filter-dropdown">
            {groups.map((group, gi) => {
              const items = group.items.map((s, i) => (
                <CommandItem
                  key={`${gi}-${s.value}-${i}`}
                  value={`${gi}-${s.value}-${i}`}
                  disabled={!!s.disabled}
                  onSelect={() => applySuggestion(s)}
                  className="g-flex g-items-center g-justify-between g-gap-3"
                >
                  <span
                    className={cn(
                      'g-truncate',
                      s.isWildcard && 'g-text-primary-600 g-italic',
                      s.entityKey === 'taxonKey' && 'g-italic',
                      !s.isFilterName && !s.isPreset && !s.entityKey && 'g-font-mono'
                    )}
                  >
                    {s.isWildcard ? '∗ ' : ''}
                    {highlight(s.label, parsed.valueQuery)}
                  </span>
                  {s.meta && (
                    <span className="g-text-xs g-text-slate-400 g-whitespace-nowrap g-shrink-0">{s.meta}</span>
                  )}
                </CommandItem>
              ));
              return group.heading ? (
                <CommandGroup key={gi} heading={group.heading}>
                  {items}
                </CommandGroup>
              ) : (
                <Fragment key={gi}>{items}</Fragment>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
