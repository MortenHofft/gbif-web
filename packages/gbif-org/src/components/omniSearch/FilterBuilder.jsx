import { Fragment, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Command } from 'cmdk';
import { FILTER_CONFIG as DEFAULT_FILTER_CONFIG, GBIF_GRAPHQL_URL } from './filterConfig';
import { WILDCARD_OPTION, parseInput, getIntegerRangeSuggestions, getStringRangeSuggestions, getGeoTimeRangeSuggestions } from './utils';
import { filtersToQuery } from './filterUrl';

// ── Data fetching ─────────────────────────────────────────────────────────────

// Normalise enum values: support either a bare string list or
// [{value, label}] for filters that want friendlier display text
// (e.g. ISO country code → country name).
function normaliseEnumValue(v) {
  return typeof v === 'string' ? { value: v, label: v } : v;
}

async function fetchValueSuggestions(cfg, query) {
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
    const options = [
      { value: 'true',  label: 'true',  meta: null },
      { value: 'false', label: 'false', meta: null },
    ];
    const q = query.toLowerCase();
    const filtered = q ? options.filter(o => o.value.startsWith(q)) : options;
    return [WILDCARD_OPTION, ...filtered];
  }

  if (cfg.type === 'enum') {
    const q = query.toLowerCase();
    const results = cfg.values
      .map(normaliseEnumValue)
      .filter(v => !q
        || v.value.toLowerCase().includes(q)
        || v.label.toLowerCase().includes(q))
      .map(v => ({
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
    if (cfg.type === 'suggestEntity') return items.map(cfg.toSuggestion);

    const apiSuggs = items.map(name => ({ value: name, label: name, meta: null }));
    if (cfg.wildcardPattern && /[?*]/.test(query)) {
      return [
        { value: query, label: query, meta: 'wildcard pattern', isPatternValue: true },
        ...apiSuggs.filter(s => s.value !== query),
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
    const results = (data?.vocabularyConceptSearch?.results ?? []).map(r => ({
      value: r.name,
      label: r.uiLabel ?? r.name,
      meta:  r.uiLabel && r.name !== r.uiLabel ? r.name : null,
    }));
    // The vocab API matches against alt labels and definitions too (e.g. "holoty"
    // returns isotype/neotype because their definitions mention holotype) — filter
    // client-side to keep only items where the query appears in the name or label.
    const q = query.trim();
    if (!q) return [WILDCARD_OPTION, ...results];
    const ql = q.toLowerCase();
    return results.filter(r =>
      r.value.toLowerCase().includes(ql) || r.label.toLowerCase().includes(ql),
    );
  }

  return [];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Partition suggestions into groups separated by section-header entries so we
// can render them as <Command.Group> blocks. Items appearing before any header
// form an initial group with no heading.
function groupSuggestions(suggestions) {
  const groups = [];
  let current = { heading: null, items: [] };
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

function highlight(text, query) {
  if (!text || !query) return text ?? '';
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong style={{ color: '#4f46e5' }}>{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FilterChip({ filter, onRemove }) {
  const showNotBadge = filter.negated && filter.value !== '*';
  return (
    <span style={filter.negated ? chipNegStyle : chipStyle}>
      {showNotBadge && <span style={negBadgeStyle}>NOT</span>}
      <span style={filter.negated ? chipKeyNegStyle : chipKeyStyle}>{filter.filterLabel}</span>
      <span style={filter.negated ? chipValueNegStyle : chipValueStyle}>{filter.valueLabel}</span>
      <button
        style={chipRemoveStyle}
        onMouseDown={e => { e.preventDefault(); onRemove(); }}
        onTouchEnd={e => { e.preventDefault(); onRemove(); }}
        aria-label={`Remove ${filter.filterLabel} filter`}
      >
        ×
      </button>
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Controlled / uncontrolled filter builder.
 *
 * Controlled:   pass value (FilterItem[]) + onChange(FilterItem[]) — the
 *               parent owns the array; the component re-renders when value changes.
 * Uncontrolled: omit value; the component manages its own state and fires
 *               onChange whenever the list changes.
 */
export default function FilterBuilder({
  value: valueProp,
  onChange,
  filterConfig = DEFAULT_FILTER_CONFIG,
  rootEntities = ['taxonKey'],
  shortcuts = [],
  valueActions = [],
  showChipsInInput = true,
  openOnFocus = false,
  title = 'GBIF Filter Builder',
  subtitle,
  placeholder = 'Search filters…',
  queryLabel = 'URL Parameters',
  // When embedding the box inside another UI (e.g. a host app's filter bar)
  // the page chrome isn't wanted. Both default to true so the standalone
  // demo — and the existing test-suite — keep their original behaviour.
  showHeader = true,
  showQueryPreview = true,
}) {
  const isControlled = valueProp !== undefined;

  const filterMap = useMemo(
    () => Object.fromEntries(filterConfig.map(f => [f.key, f])),
    [filterConfig],
  );

  // Internal state is always used; in controlled mode it mirrors valueProp.
  const [internalFilters, setInternalFilters] = useState(valueProp ?? []);

  // When the parent passes a new value (e.g. URL navigation), sync it in.
  useEffect(() => {
    if (isControlled) setInternalFilters(valueProp);
  }, [valueProp]); // eslint-disable-line react-hooks/exhaustive-deps

  const filters = isControlled ? valueProp : internalFilters;

  // Single update helper: always notify the parent.
  const changeFilters = useCallback((newFilters) => {
    if (!isControlled) setInternalFilters(newFilters);
    onChange?.(newFilters);
  }, [isControlled, onChange]);
  const [inputText,    setInputText]    = useState('');
  const [suggestions,  setSuggestions]  = useState([]);
  const [isLoading,    setIsLoading]    = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [focused,      setFocused]      = useState(false);
  const [copied,       setCopied]       = useState(false);

  const inputRef          = useRef(null);
  const debounceRef       = useRef(null);
  const blurTimerRef      = useRef(null);
  const rootQueryRef      = useRef('');
  const entityResultsRef  = useRef({});
  // Mirror `focused` into a ref so the suggestion effect (deps: [inputText])
  // can branch on the current focus state without re-running on every blur.
  const focusedRef        = useRef(false);
  useEffect(() => { focusedRef.current = focused; }, [focused]);

  const parsed = useMemo(() => parseInput(inputText), [inputText]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    const filterCfg = filterMap[parsed.filterName];
    const isApiCall = parsed.mode === 'filter_value' &&
      filterCfg && ['suggestString', 'suggestEntity', 'vocabulary', 'suggestStringRange', 'geoTimeRange'].includes(filterCfg.type);

    // Switching into filter_value mode with an API-backed type: replace any
    // stale items (e.g. filter-name suggestions from the prior step) with
    // just the wildcard so the dropdown isn't misleading while we wait.
    if (isApiCall) {
      setSuggestions([WILDCARD_OPTION]);
      setShowDropdown(true);
      setIsLoading(true);
    }

    debounceRef.current = setTimeout(async () => {
      if (parsed.mode === 'filter_name') {
        const q          = parsed.valueQuery.toLowerCase();
        const filterText = parsed.valueQuery.trim();

        // Generous matching: substring on key, label, or any alias, ranked
        // so that prefix matches surface ahead of mid-string matches
        // (e.g. "year" → year, startDayOfYear, endDayOfYear). Aliases let
        // a filter expose multiple user-facing names (e.g. "Scientific
        // name" alongside the raw key `taxonKey`).
        const score = (f) => {
          const key      = f.key.toLowerCase();
          const label    = f.label.toLowerCase();
          const aliases  = (f.aliases ?? []).map(a => a.toLowerCase());
          if (key.startsWith(q))                   return 3;
          if (label.startsWith(q))                 return 2;
          if (aliases.some(a => a.startsWith(q))) return 2;
          if (key.includes(q))                     return 1;
          if (label.includes(q))                   return 0;
          if (aliases.some(a => a.includes(q)))   return 0;
          return -1;
        };
        // When the user has typed `!` / `not `, only fields that opt in to
        // negation may appear. Defaults to true so existing configs (e.g.
        // the occurrence catalogue) keep their current behaviour; the
        // dataset config opts every field out, so `!` yields no matches.
        const negationOk = (f) => !parsed.negated || f.supportsNegation !== false;
        const matches = filterText
          ? filterConfig
              .filter(f => f.key !== 'q' && negationOk(f))
              .map(f => ({ f, s: score(f) }))
              .filter(x => x.s >= 0)
              .sort((a, b) => b.s - a.s)
              .map(x => x.f)
          : filterConfig.filter(f => f.key !== 'q' && negationOk(f));
        // Display the friendly label (e.g. "Taxon") as the primary text;
        // the raw key still drives URL serialisation and is also searched
        // by `score` above so power users can find filters by param name.
        const nameSuggestions = matches.map(f => ({
          value: f.key, label: f.label, meta: f.hint, isFilterName: true,
        }));
        // Free-text fallback is always non-negated (`q` doesn't sensibly
        // support negation), so hide it whenever the user typed `!`.
        const textOption = filterText && !parsed.negated && filterMap['q']
          ? [{ value: filterText, label: `"${filterText}"`, meta: 'Free-text search across all fields · param: q', isQuickText: true }]
          : [];

        // Shortcuts: previously-applied filters, excluding ones already in the
        // current filter list (parent is responsible for that exclusion too,
        // but dedupe here in case the prop is stale).
        const activeKeys = new Set(filters.map(f => `${f.negated ? '!' : ''}${f.filterName}=${f.value}`));
        const shortcutSuggs = shortcuts
          .filter(sc => !activeKeys.has(`${sc.negated ? '!' : ''}${sc.filterName}=${sc.value}`))
          // When `!` is typed, only surface recents that are themselves
          // negated — a positive recent would silently apply as a positive
          // chip (shortcuts carry their own `negated` flag), contradicting
          // the user's explicit `!` prefix.
          .filter(sc => !parsed.negated || sc.negated)
          .filter(sc => !filterText
            || sc.filterName.toLowerCase().includes(q)
            || sc.filterLabel?.toLowerCase().includes(q)
            || sc.valueLabel?.toLowerCase().includes(q))
          .map(sc => ({
            value:       `__sc_${sc.filterName}_${sc.value}`,
            label:       `${sc.filterLabel}: ${sc.valueLabel}`,
            meta:        sc.negated ? `NOT ${sc.filterName}` : sc.filterName,
            isShortcut:  true,
            shortcut:    sc,
          }));

        // Phase 1: show filter names + shortcuts immediately (no network).
        // Section the list only when shortcuts are present, to avoid
        // adding header chrome for the common case of no recents.
        const phase1 = shortcutSuggs.length ? [
          { isSectionHeader: true, label: 'Recent', value: '__sec_recent' },
          ...shortcutSuggs,
          ...(nameSuggestions.length ? [
            { isSectionHeader: true, label: 'Filters', value: '__sec_filters' },
            ...nameSuggestions,
          ] : []),
          ...textOption,
        ] : [...nameSuggestions, ...textOption];
        setSuggestions(phase1);
        // Only auto-open while in filter_name mode when the user has typed
        // something. Focus-opening (and the post-chip reopen, when enabled)
        // are handled by onFocus + the openOnFocus prop. An empty input
        // never opens the dropdown by itself — that fixes the "dropdown
        // appears on page reload / after applying a value" surprise.
        const hasQuery = parsed.valueQuery.trim().length > 0;
        if (phase1.length === 0)                         setShowDropdown(false);
        else if (hasQuery)                               setShowDropdown(true);
        else if (openOnFocus && focusedRef.current)      setShowDropdown(true);

        // Phase 2: fetch inline suggestions for each configured root entity
        // (taxa, basisOfRecord, etc.) and splice them in as sections.
        // Entries may be a bare filter key (string) or an object
        // { key, minChars } — minChars lets noisy entities wait for a few
        // characters before triggering (e.g. typeStatus, minChars: 3).
        //
        // Each entity is fired independently and the dropdown is rebuilt as
        // each one resolves — a slow vocab call (typeStatus) doesn't hold
        // back a fast one (taxonKey).
        // Skip root-entity inline suggestions once the user has typed `!` —
        // a `!` query is an explicit declaration of intent ("I want to
        // negate a field"), so leading the user into a taxon/dataset value
        // lookup instead would be misleading.
        if (filterText && rootEntities.length && !parsed.negated) {
          rootQueryRef.current = filterText;
          entityResultsRef.current = {};
          const rebuild = () => {
            const accumulated = entityResultsRef.current;
            const sections = rootEntities
              .map(e => (typeof e === 'string' ? e : e.key))
              .filter(k => accumulated[k])
              .map(k => ({ key: k, ...accumulated[k] }));
            if (!sections.length) return;
            const combined = [
              ...(shortcutSuggs.length ? [
                { isSectionHeader: true, label: 'Recent', value: '__sec_recent' },
                ...shortcutSuggs,
              ] : []),
              ...(nameSuggestions.length ? [
                { isSectionHeader: true, label: 'Filters', value: '__sec_filters' },
                ...nameSuggestions,
              ] : []),
              ...sections.flatMap(section => [
                { isSectionHeader: true, label: section.cfg.label, value: `__sec_${section.key}` },
                ...(section.error
                  ? [{ value: `__err_${section.key}`, label: `Failed to load ${section.cfg.label} suggestions`, meta: 'API error', disabled: true }]
                  : section.suggs),
              ]),
              ...textOption,
            ];
            setSuggestions(combined);
          };
          rootEntities.forEach(async (entry) => {
            const { key, minChars = 1 } = typeof entry === 'string' ? { key: entry } : entry;
            if (filterText.length < minChars) return;
            const cfg = filterMap[key];
            if (!cfg) return;
            try {
              const raw = await fetchValueSuggestions(cfg, filterText);
              if (rootQueryRef.current !== filterText) return;
              const suggs = raw
                .filter(s => !s.isWildcard && !s.disabled && s.value && s.label)
                .slice(0, 5)
                .map(s => ({ ...s, isRootEntitySuggestion: true, entityKey: key }));
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
        setShowDropdown(false);
        return;
      }

      setIsLoading(true);
      try {
        const raw = await fetchValueSuggestions(filterCfg, parsed.valueQuery);
        // Some backends (e.g. the GBIF dataset registry) have no
        // exists/has-value predicate. Strip the wildcard option for those
        // fields so it can't be selected.
        const suggs = filterCfg.supportsExistence === false
          ? raw.filter(s => !s.isWildcard)
          : raw;
        setSuggestions(suggs);
        setShowDropdown(suggs.length > 0);
      } catch {
        const errorRows = [
          { value: '__err', label: 'Failed to load suggestions', meta: 'API error', disabled: true },
        ];
        setSuggestions(filterCfg.supportsExistence === false
          ? errorRows
          : [WILDCARD_OPTION, ...errorRows]);
        setShowDropdown(true);
      } finally {
        setIsLoading(false);
      }
    }, isApiCall ? 280 : 0);
  }, [inputText]); // eslint-disable-line react-hooks/exhaustive-deps

  const applySuggestion = useCallback((s) => {
    if (s.disabled || s.isSectionHeader) return;
    if (s.isShortcut) {
      const sc = s.shortcut;
      changeFilters([...filters, {
        id:          crypto.randomUUID(),
        filterName:  sc.filterName,
        filterLabel: sc.filterLabel,
        value:       sc.value,
        valueLabel:  sc.valueLabel,
        negated:     !!sc.negated,
      }]);
      setInputText('');
      setShowDropdown(false);
      inputRef.current?.focus();
      return;
    }
    if (s.extendRange) {
      // Insert the picked value as the start of a range, keeping the
      // dropdown open so the user can choose the second endpoint.
      setInputText(`${parsed.negated ? '!' : ''}${parsed.filterName}=${s.value},`);
      setShowDropdown(true);
      inputRef.current?.focus();
      return;
    }
    if (s.isRootEntitySuggestion) {
      const cfg = filterMap[s.entityKey];
      changeFilters([...filters, {
        id:          crypto.randomUUID(),
        filterName:  s.entityKey,
        filterLabel: cfg?.label ?? s.entityKey,
        value:       s.value,
        valueLabel:  cfg?.formatValue?.(s.value) ?? s.chipLabel ?? s.label,
        negated:     parsed.negated,
      }]);
      setInputText('');
      setShowDropdown(false);
      inputRef.current?.focus();
      return;
    }
    if (s.isFilterName) {
      setInputText((parsed.negated ? '!' : '') + s.value + '=');
      inputRef.current?.focus();
      return;
    }
    if (s.isQuickText) {
      const cfg = filterMap['q'];
      changeFilters([...filters, {
        id:          crypto.randomUUID(),
        filterName:  'q',
        filterLabel: cfg?.label ?? 'Text Search',
        value:       s.value,
        valueLabel:  `"${s.value}"`,
        negated:     false,
      }]);
      setInputText('');
      setShowDropdown(false);
      inputRef.current?.focus();
      return;
    }
    const filterCfg = filterMap[parsed.filterName];
    changeFilters([...filters, {
      id:          crypto.randomUUID(),
      filterName:  parsed.filterName,
      filterLabel: filterCfg?.label ?? parsed.filterName,
      value:       s.value,
      valueLabel:  s.isWildcard
        ? (parsed.negated ? 'has no value' : 'has any value')
        : (filterCfg?.formatValue?.(s.value) ?? s.chipLabel ?? s.label),
      negated:     parsed.negated,
    }]);
    setInputText('');
    setShowDropdown(false);
    inputRef.current?.focus();
  }, [parsed.filterName, parsed.negated, filters, changeFilters]);

  const commandRef = useRef(null);

  // The suggestions array is rebuilt by the effect, but in some flows
  // (e.g. applying a shortcut from an empty input) inputText doesn't change
  // and the effect doesn't re-run. Drop now-stale shortcut items at render
  // time so the dropdown reflects the current filter list immediately.
  const visibleSuggestions = useMemo(() => {
    const validKeys = new Set(shortcuts.map(sc =>
      `${sc.negated ? '!' : ''}${sc.filterName}=${sc.value}`,
    ));
    const filtered = suggestions.filter(s => {
      if (!s.isShortcut) return true;
      const sc = s.shortcut;
      return validKeys.has(`${sc.negated ? '!' : ''}${sc.filterName}=${sc.value}`);
    });
    // Drop any section header that no longer has items beneath it.
    return filtered.filter((s, i) => {
      if (!s.isSectionHeader) return true;
      const next = filtered[i + 1];
      return next && !next.isSectionHeader;
    });
  }, [suggestions, shortcuts]);

  // cmdk handles ArrowUp/Down/Enter internally; we only need Tab/Escape/Backspace,
  // plus ArrowDown to re-open the dropdown after it's been dismissed.
  const handleKeyDown = (e) => {
    if (!showDropdown && e.key === 'ArrowDown' && visibleSuggestions.length > 0) {
      setShowDropdown(true);
      return;
    }
    if (showDropdown && visibleSuggestions.length > 0) {
      if (e.key === 'Tab') {
        const selected = commandRef.current?.querySelector('[cmdk-item=""][data-selected="true"]');
        if (selected) { e.preventDefault(); selected.click(); return; }
      }
      if (e.key === 'Escape') { e.preventDefault(); setShowDropdown(false); return; }
    }
    if (e.key === 'Backspace' && inputText === '' && filters.length > 0) {
      changeFilters(filters.slice(0, -1));
    }
  };

  const removeFilter = useCallback((id) => {
    changeFilters(filters.filter(f => f.id !== id));
  }, [filters, changeFilters]);

  const urlParams = filtersToQuery(filters, filterMap);

  const copyParams = async () => {
    await navigator.clipboard?.writeText('?' + urlParams);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const hint = (() => {
    if (!inputText && filters.length === 0) return 'Type a filter name, or prefix with "not " / "!" to negate — e.g. not basisOfRecord';
    if (parsed.mode === 'filter_name' && inputText) return `${parsed.negated ? '[negated] ' : ''}↑↓ navigate · Enter / Tab to select · Esc to dismiss`;
    if (parsed.mode === 'filter_value') {
      const filterCfg = filterMap[parsed.filterName];
      const base = `${parsed.negated ? 'NOT ' : ''}${parsed.filterName}`;
      return filterCfg?.wildcardPattern
        ? `${base} · ? = one char · * = any chars in value · bare * = has any value`
        : `${base} · type * for "has any / no value"`;
    }
    return 'Add another filter, or press Backspace to remove the last one';
  })();

  return (
    <div style={rootStyle}>
      {showHeader && <h1 style={headingStyle}>{title}</h1>}
      {showHeader && subtitle && <p style={subStyle}>{subtitle}</p>}

      {/* ── Input box ── */}
      <Command
        ref={commandRef}
        shouldFilter={false}
        loop
        onKeyDown={handleKeyDown}
        style={{ position: 'relative' }}
      >
        <div
          style={boxStyle(focused)}
          onClick={() => inputRef.current?.focus()}
        >
          {showChipsInInput && filters.map(f => (
            <FilterChip key={f.id} filter={f} onRemove={() => removeFilter(f.id)} />
          ))}
          <Command.Input
            ref={inputRef}
            value={inputText}
            onValueChange={(v) => { setInputText(v); setShowDropdown(true); }}
            onFocus={() => {
              clearTimeout(blurTimerRef.current);
              setFocused(true);
              if (openOnFocus) setShowDropdown(true);
            }}
            onBlur={() => {
              setFocused(false);
              blurTimerRef.current = setTimeout(() => setShowDropdown(false), 150);
            }}
            placeholder={!inputText && (!showChipsInInput || filters.length === 0) ? placeholder : ''}
            style={inputStyle}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="none"
          />
          {isLoading && <span style={spinnerStyle}>loading…</span>}
        </div>

        {/* ── Dropdown ── */}
        {showDropdown && visibleSuggestions.length > 0 && (
          <Command.List data-testid="filter-dropdown" style={dropdownStyle}>
            <div style={dropdownHeaderStyle}>
              {parsed.mode === 'filter_name'
                ? parsed.negated ? <>Negated filter fields <span style={{ color: '#dc2626' }}>(!)</span></> : 'Filter fields'
                : <>{parsed.negated && <span style={{ color: '#dc2626', marginRight: '4px' }}>NOT</span>}Values for <strong style={{ color: '#4b5563' }}>{parsed.filterName}</strong></>}
            </div>
            {groupSuggestions(visibleSuggestions).map((group, gi) => {
              const items = group.items.map((s, i) => (
                <Command.Item
                  key={`${gi}-${s.value}-${i}`}
                  value={`${gi}-${s.value}-${i}`}
                  disabled={!!s.disabled}
                  onSelect={() => applySuggestion(s)}
                  style={itemBaseStyle(s.disabled)}
                >
                  <span style={
                    s.isWildcard ? itemWildcardStyle
                    : s.entityKey === 'taxonKey' ? taxonLabelStyle
                    : (s.isFilterName || s.isPreset) ? itemFilterNameStyle
                    : itemLabelStyle
                  }>
                    {s.isWildcard ? '∗  ' : ''}{highlight(s.label, parsed.valueQuery)}
                  </span>
                  {s.meta && <span className="cmdk-item-meta" style={itemMetaStyle}>{s.meta}</span>}
                </Command.Item>
              ));
              return group.heading ? (
                <Command.Group key={gi} heading={group.heading}>{items}</Command.Group>
              ) : (
                <Fragment key={gi}>{items}</Fragment>
              );
            })}
            {isLoading && <div style={loadingRowStyle}>Loading suggestions…</div>}
            {(() => {
              const cfg = parsed.mode === 'filter_value' ? filterMap[parsed.filterName] : null;
              const visibleActions = cfg ? valueActions.filter(a => !a.when || a.when(cfg)) : [];
              const showWildcardFooter = cfg?.wildcardPattern;
              if (!visibleActions.length && !showWildcardFooter) return null;
              return (
                <div style={pinnedBottomStyle}>
                  {visibleActions.length > 0 && (
                    <Command.Group heading="Analysis">
                      {visibleActions.map((action, i) => (
                        <Command.Item
                          key={`__action_${action.id ?? i}`}
                          value={`__action_${action.id ?? i}`}
                          forceMount
                          onSelect={() => action.onSelect({
                            filterName:  parsed.filterName,
                            filterLabel: cfg.label,
                            valueQuery:  parsed.valueQuery,
                            negated:     parsed.negated,
                            cfg,
                            filters,
                          })}
                          style={itemBaseStyle(false)}
                        >
                          <span style={itemLabelStyle}>{action.label}</span>
                          {action.meta && <span className="cmdk-item-meta" style={itemMetaStyle}>{action.meta}</span>}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}
                  {showWildcardFooter && (
                    <div style={wildcardFooterStyle}>
                      ⓘ&nbsp; <strong>?</strong> matches exactly one character &nbsp;·&nbsp; <strong>*</strong> matches any characters
                    </div>
                  )}
                </div>
              );
            })()}
          </Command.List>
        )}
      </Command>

      <p style={hintStyle}>{hint}</p>

      {/* ── URL preview ── */}
      {showQueryPreview && filters.length > 0 && (
        <div style={urlBoxStyle}>
          <div style={urlLabelStyle}>{queryLabel}</div>
          <div style={urlValueStyle}>
            <span style={{ color: '#9ca3af' }}>?</span>
            {urlParams}
          </div>
          <button style={copyBtnStyle} onClick={copyParams}>
            {copied ? '✓ Copied!' : 'Copy params'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const rootStyle = {
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  maxWidth: '700px',
  margin: '0 auto',
  color: '#111827',
};

const headingStyle = {
  fontSize: '22px', fontWeight: 700, margin: '0 0 6px',
};

const subStyle = {
  fontSize: '14px', color: '#6b7280', margin: '0 0 28px',
};

const boxStyle = (focused) => ({
  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px',
  minHeight: '48px', padding: '5px 10px',
  border: `2px solid ${focused ? '#6366f1' : '#d1d5db'}`,
  borderRadius: '12px', background: '#fff', cursor: 'text',
  boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.12)' : '0 1px 3px rgba(0,0,0,0.06)',
  transition: 'border-color 0.15s, box-shadow 0.15s',
});

const chipStyle = {
  display: 'inline-flex', alignItems: 'center', gap: '5px',
  padding: '3px 10px 3px 8px',
  background: '#eef2ff', border: '1px solid #c7d2fe',
  borderRadius: '9999px', userSelect: 'none',
};

const chipNegStyle = {
  ...chipStyle,
  background: '#fef2f2', border: '1px solid #fecaca',
};

const chipKeyStyle = {
  fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: '#6366f1',
};

const chipKeyNegStyle = { ...chipKeyStyle, color: '#dc2626' };

const chipValueStyle = {
  fontSize: '13px', fontWeight: 500, color: '#3730a3',
  fontFamily: 'monospace',
};

const chipValueNegStyle = { ...chipValueStyle, color: '#991b1b' };

const negBadgeStyle = {
  fontSize: '9px', fontWeight: 800, color: '#dc2626',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  background: '#fee2e2', borderRadius: '3px', padding: '1px 4px',
};

const chipRemoveStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#a5b4fc', fontSize: '16px', lineHeight: 1,
  padding: '4px 6px', marginLeft: '0', display: 'flex', alignItems: 'center',
  WebkitTapHighlightColor: 'transparent',
};

const inputStyle = {
  flex: '1 1 120px', border: 'none', outline: 'none',
  fontSize: '14px', padding: '4px 2px', minWidth: '80px',
  background: 'transparent', color: '#111827', fontFamily: 'inherit',
};

const spinnerStyle = {
  fontSize: '12px', color: '#9ca3af', alignSelf: 'center', padding: '0 6px',
  fontStyle: 'italic',
};

const dropdownStyle = {
  position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
  background: '#fff', border: '1px solid #e5e7eb',
  borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
  zIndex: 100, overflow: 'auto',
  maxHeight: '60vh', WebkitOverflowScrolling: 'touch',
};

const pinnedBottomStyle = {
  position: 'sticky',
  bottom: 0,
  background: '#fff',
  borderTop: '1px solid #e5e7eb',
  borderBottomLeftRadius: '12px',
  borderBottomRightRadius: '12px',
  zIndex: 1,
};

const wildcardFooterStyle = {
  padding: '8px 14px',
  fontSize: '12px', color: '#1d4ed8',
  background: '#eff6ff', borderTop: '1px solid #bfdbfe',
  borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px',
};

const dropdownHeaderStyle = {
  padding: '8px 14px 6px', fontSize: '11px', fontWeight: 600,
  color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em',
  borderBottom: '1px solid #f3f4f6', background: '#fafafa',
};

const loadingRowStyle = {
  padding: '10px 14px',
  fontSize: '12px',
  fontStyle: 'italic',
  color: '#9ca3af',
  borderBottom: '1px solid #f9fafb',
};

const itemBaseStyle = (disabled) => ({
  padding: '9px 14px',
  minHeight: '44px',
  cursor: disabled ? 'default' : 'pointer',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  borderBottom: '1px solid #f9fafb',
  opacity: disabled ? 0.5 : 1,
  WebkitTapHighlightColor: 'transparent',
});

const itemLabelStyle = {
  fontFamily: 'monospace', fontWeight: 500, fontSize: '14px', color: '#111827',
};

const itemFilterNameStyle = {
  fontWeight: 500, fontSize: '14px', color: '#111827',
};

const taxonLabelStyle = {
  fontStyle: 'italic', fontSize: '14px', color: '#111827',
};

const itemWildcardStyle = {
  ...itemLabelStyle, color: '#6366f1', fontStyle: 'italic',
};

const itemMetaStyle = {
  fontSize: '12px', color: '#9ca3af', marginLeft: '12px',
  whiteSpace: 'nowrap', flexShrink: 0,
};

const hintStyle = {
  fontSize: '12px', color: '#9ca3af', margin: '8px 0 0', minHeight: '18px',
};

const urlBoxStyle = {
  marginTop: '32px', padding: '16px 18px',
  background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '12px',
};

const urlLabelStyle = {
  fontSize: '11px', fontWeight: 700, color: '#6b7280',
  textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px',
};

const urlValueStyle = {
  fontFamily: 'monospace', fontSize: '13px', color: '#374151',
  wordBreak: 'break-all', lineHeight: 1.7,
};

const copyBtnStyle = {
  marginTop: '12px', fontSize: '12px', color: '#6366f1',
  background: 'none', border: '1px solid #c7d2fe',
  borderRadius: '6px', padding: '4px 12px',
  cursor: 'pointer', fontFamily: 'inherit',
};
