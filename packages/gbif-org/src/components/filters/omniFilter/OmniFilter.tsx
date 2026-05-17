import { Command as CommandPrimitive } from 'cmdk';
import {
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useIntl } from 'react-intl';
import { useConfig } from '@/config/config';
import { FilterContext } from '@/contexts/filter';
import { useSearchContext } from '@/contexts/search';
import { useChecklistKey } from '@/hooks/useChecklistKey';
import { useCountrySuggest } from '@/hooks/useCountrySuggest';
import { useI18n } from '@/reactRouterPlugins';
import { cn } from '@/utils/shadcn';
import { CANCEL_REQUEST } from '@/utils/fetchWithCancel';
import { Filters } from '../filterTools';
import { parseInput } from './parseInput';
import { OMNI_FILTER_CONFIG } from './omniFilterConfig';
import { useFilterHistory } from './useFilterHistory';
import { fetchValueSuggestions, ValueSuggestion } from './valueProviders';
import {
  DropdownItem,
  buildFilterNameItems,
  collapseToGroups,
  getOmniFilters,
  mergeRootEntitySections,
} from './omniFilterItems';

type Props = {
  filters: Filters;
  rootEntities?: Array<string | { handle: string; minChars?: number }>;
  className?: string;
  placeholder?: string;
};

export function OmniFilter({ filters, rootEntities = [], className, placeholder }: Props) {
  const intl = useIntl();
  const siteConfig = useConfig();
  const searchContext = useSearchContext();
  const { locale: currentLocale } = useI18n();
  const checklistKey = useChecklistKey();
  const countrySuggest = useCountrySuggest();
  const filterContext = useContext(FilterContext);
  const { history, record } = useFilterHistory();

  const [inputText, setInputText] = useState('');
  const [items, setItems] = useState<DropdownItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const rootCancelsRef = useRef<Array<() => void>>([]);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootQueryRef = useRef<string>('');

  const parsed = useMemo(() => parseInput(inputText), [inputText]);

  // Stabilize the rootEntities prop so it doesn't trigger the suggestion
  // effect on every render when the caller passes an inline array literal.
  const rootEntitiesKey = JSON.stringify(rootEntities);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableRootEntities = useMemo(() => rootEntities, [rootEntitiesKey]);

  // Build the filter-name list once per filters map; this is the searchable
  // catalogue. We exclude entries we don't have an omni-value-provider for
  // and exclude inherently dialog-based ones (geometry, customPredicate, …).
  const omniFilters = useMemo(() => getOmniFilters(filters, OMNI_FILTER_CONFIG), [filters]);

  // Apply a single value to FilterContext. The existing FilterButton picks it
  // up and renders the chip — this component never holds chips itself.
  const applyValue = useCallback(
    (handle: string, predicate: unknown, negated: boolean, valueLabel: string) => {
      filterContext.add(handle, predicate, negated);
      const filterLabel = filters[handle]?.translatedFilterName ?? handle;
      record({ handle, filterLabel, value: predicate, valueLabel, negated });
      setInputText('');
      setOpen(true);
      inputRef.current?.focus();
    },
    [filterContext, filters, record]
  );

  // ── Dropdown content ──
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (cancelRef.current) cancelRef.current();
    rootCancelsRef.current.forEach((c) => c());
    rootCancelsRef.current = [];

    const ctx = {
      intl,
      siteConfig,
      searchContext,
      currentLocale,
      checklistKey,
      countrySuggest,
    };

    if (parsed.mode === 'filter_name') {
      const q = parsed.valueQuery;
      const sections = buildFilterNameItems({
        parsed,
        omniFilters,
        history,
        freeTextFallbackMeta: intl.formatMessage({
          id: 'filters.q.name',
          defaultMessage: 'Free-text search',
        }),
        recentHeading: intl.formatMessage({
          id: 'filterSupport.recent',
          defaultMessage: 'Recent',
        }),
        filtersHeading: intl.formatMessage({
          id: 'filterSupport.filters',
          defaultMessage: 'Filters',
        }),
      });
      setItems(sections);
      setLoading(false);

      // Inline root-entity value suggestions, fired in parallel per entity.
      // Each entity's results are merged into the dropdown as it resolves.
      if (q && stableRootEntities.length) {
        rootQueryRef.current = q;
        const resultsByHandle: Record<string, ValueSuggestion[]> = {};
        const rebuild = () => {
          const merged = mergeRootEntitySections({
            baseItems: sections,
            rootEntities: stableRootEntities,
            sectionsByHandle: resultsByHandle,
            filters,
          });
          if (merged !== sections) setItems(merged);
        };

        for (const entry of stableRootEntities) {
          const handle = typeof entry === 'string' ? entry : entry.handle;
          const minChars = typeof entry === 'string' ? 1 : entry.minChars ?? 1;
          if (q.length < minChars) continue;
          const cfg = OMNI_FILTER_CONFIG[handle];
          if (!cfg) continue;
          const { promise, cancel } = fetchValueSuggestions(cfg, q, ctx);
          rootCancelsRef.current.push(cancel);
          promise
            .then((results) => {
              if (rootQueryRef.current !== q) return;
              resultsByHandle[handle] = results ?? [];
              rebuild();
            })
            .catch((err) => {
              if (err === CANCEL_REQUEST) return;
              // Silent — a slow or failing root entity shouldn't block the rest.
              console.warn(`OmniFilter root entity '${handle}' fetch failed`, err);
            });
        }
      }
      return;
    }

    // ── filter_value mode ──
    rootQueryRef.current = '';
    const cfg = OMNI_FILTER_CONFIG[parsed.filterName ?? ''];
    if (!cfg) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Debounce only the API-backed providers — local enums/booleans are instant.
    const isAsync = ['suggest', 'taxon', 'geologicalTime'].includes(cfg.value.kind);
    debounceRef.current = setTimeout(
      () => {
        const { promise, cancel } = fetchValueSuggestions(cfg, parsed.valueQuery, ctx);
        cancelRef.current = cancel;
        promise
          .then((results) => {
            const valueItems: DropdownItem[] = (results ?? []).map((v, i) => ({
              kind: 'value',
              id: `val-${cfg.handle}-${i}`,
              handle: cfg.handle,
              value: v,
            }));
            setItems(valueItems);
            setLoading(false);
          })
          .catch((err) => {
            if (err === CANCEL_REQUEST) return;
            // Don't let API failures bubble up — silently show no values.
            console.warn('OmniFilter value fetch failed', err);
            setItems([]);
            setLoading(false);
          });
      },
      isAsync ? 280 : 0
    );
  }, [
    inputText,
    omniFilters,
    history,
    stableRootEntities,
    intl,
    siteConfig,
    searchContext,
    currentLocale,
    checklistKey,
    countrySuggest,
    filters,
    parsed.filterName,
    parsed.mode,
    parsed.valueQuery,
  ]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (cancelRef.current) cancelRef.current();
      rootCancelsRef.current.forEach((c) => c());
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    },
    []
  );

  const selectItem = useCallback(
    (item: DropdownItem) => {
      if (item.kind === 'section') return;
      if (item.kind === 'filterName') {
        setInputText((parsed.negated ? '!' : '') + item.handle + '=');
        setOpen(true);
        inputRef.current?.focus();
        return;
      }
      if (item.kind === 'shortcut') {
        const e = item.entry;
        applyValue(e.handle, e.value, e.negated, e.valueLabel);
        return;
      }
      // value
      const chipLabel = item.value.chipLabel ?? String(item.value.label);
      applyValue(item.handle, item.value.predicate, parsed.negated, chipLabel);
    },
    [applyValue, parsed.negated]
  );

  // Build cmdk groups. We collapse adjacent sections so a section with no
  // children doesn't render an empty header.
  const groups = useMemo(() => collapseToGroups(items), [items]);

  const commandRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open && e.key === 'ArrowDown' && items.length > 0) {
      setOpen(true);
      return;
    }
    if (open && items.length > 0 && e.key === 'Tab') {
      const selected = commandRef.current?.querySelector(
        '[cmdk-item=""][data-selected="true"]'
      ) as HTMLElement | null;
      if (selected) {
        e.preventDefault();
        selected.click();
      }
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const placeholderText =
    placeholder ??
    intl.formatMessage({
      id: 'filterSupport.omniSearchPlaceholder',
      defaultMessage: 'Search filters and values…',
    });

  return (
    <div className={cn('g-relative g-min-w-[240px]', className)}>
      <CommandPrimitive
        ref={commandRef}
        shouldFilter={false}
        loop
        onKeyDown={handleKeyDown}
        className="gbif"
      >
        <div
          className={cn(
            'g-flex g-items-center g-rounded g-border g-border-solid g-border-slate-200 g-bg-white g-py-1 g-px-3 g-h-8',
            'focus-within:g-ring-2 focus-within:g-ring-blue-400/70 focus-within:g-ring-offset-0 g-ring-inset'
          )}
        >
          <CommandPrimitive.Input
            ref={inputRef}
            value={inputText}
            onValueChange={(v) => {
              setInputText(v);
              setOpen(true);
            }}
            onFocus={() => {
              if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
              setOpen(true);
            }}
            onBlur={() => {
              blurTimerRef.current = setTimeout(() => setOpen(false), 150);
            }}
            placeholder={placeholderText}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="none"
            className="g-flex-auto g-text-sm g-bg-transparent g-outline-none g-border-none g-min-w-0"
          />
          {loading && (
            <span className="g-text-xs g-text-slate-400 g-italic g-ms-2 g-flex-none">…</span>
          )}
        </div>

        {open && items.length > 0 && (
          // The dropdown is wider than the input on larger screens so long
          // suggestions (e.g. dataset titles) aren't cramped, but it never
          // overflows the viewport — `max-w-[calc(100vw-...)]` clamps it.
          <CommandPrimitive.List
            className="g-absolute g-top-full g-left-0 g-mt-1 g-bg-white g-border g-border-solid g-border-slate-200 g-rounded g-shadow-lg g-z-50 g-max-h-[60vh] g-overflow-auto g-w-[800px] g-max-w-[calc(100vw-2rem)]"
            style={{ minWidth: '100%' }}
          >
            <div className="g-px-3 g-py-1.5 g-text-[11px] g-font-semibold g-text-slate-500 g-uppercase g-tracking-wide g-bg-slate-50 g-border-b g-border-slate-100">
              {parsed.mode === 'filter_name'
                ? parsed.negated
                  ? '(NOT) filter fields'
                  : 'Filter fields'
                : `${parsed.negated ? 'NOT ' : ''}${
                    filters[parsed.filterName ?? '']?.translatedFilterName ?? parsed.filterName
                  }`}
            </div>
            {groups.map((group, gi) => {
              const rows = group.items.map((it) => (
                <CommandPrimitive.Item
                  key={it.id}
                  value={it.id}
                  onSelect={() => selectItem(it)}
                  className={cn(
                    'g-flex g-justify-between g-items-center g-px-3 g-py-2 g-text-sm g-cursor-pointer',
                    'aria-selected:g-bg-slate-100'
                  )}
                >
                  <ItemLabel item={it} parsed={parsed} />
                </CommandPrimitive.Item>
              ));
              return group.heading ? (
                <CommandPrimitive.Group
                  key={`${gi}-${group.heading}`}
                  heading={group.heading}
                  className="[&_[cmdk-group-heading]]:g-px-3 [&_[cmdk-group-heading]]:g-py-1 [&_[cmdk-group-heading]]:g-text-[10px] [&_[cmdk-group-heading]]:g-font-semibold [&_[cmdk-group-heading]]:g-uppercase [&_[cmdk-group-heading]]:g-text-slate-400 [&_[cmdk-group-heading]]:g-tracking-wide"
                >
                  {rows}
                </CommandPrimitive.Group>
              ) : (
                <Fragment key={`grp-${gi}`}>{rows}</Fragment>
              );
            })}
            {loading && (
              <div className="g-px-3 g-py-2 g-text-xs g-italic g-text-slate-400">Loading…</div>
            )}
          </CommandPrimitive.List>
        )}
      </CommandPrimitive>
    </div>
  );
}

function ItemLabel({
  item,
  parsed,
}: {
  item: DropdownItem;
  parsed: ReturnType<typeof parseInput>;
}) {
  if (item.kind === 'filterName') {
    return (
      <>
        <span className="g-text-slate-800">{item.label}</span>
        <span className="g-text-[11px] g-text-slate-400 g-ms-2 g-truncate">{item.handle}</span>
      </>
    );
  }
  if (item.kind === 'shortcut') {
    const e = item.entry;
    return (
      <>
        <span className="g-text-slate-800">
          {e.negated && <span className="g-text-red-600 g-me-1">NOT</span>}
          <span className="g-font-medium">{e.filterLabel}:</span> {e.valueLabel}
        </span>
        <span className="g-text-[11px] g-text-slate-400 g-ms-2 g-truncate">{e.handle}</span>
      </>
    );
  }
  if (item.kind === 'value') {
    return (
      <>
        <span className="g-text-slate-800">
          {parsed.negated && parsed.mode === 'filter_value' && (
            <span className="g-text-red-600 g-me-1">NOT</span>
          )}
          {item.value.label}
        </span>
        {item.value.meta && (
          <span className="g-text-[11px] g-text-slate-400 g-ms-2 g-truncate">
            {item.value.meta}
          </span>
        )}
      </>
    );
  }
  return null;
}
