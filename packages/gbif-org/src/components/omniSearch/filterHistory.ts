import { useEffect, useRef, useState } from 'react';
import type { FilterItem, Shortcut } from './types';

const STORAGE_KEY = 'omni-search:filter-history';
const MAX_HISTORY = 30;
const MAX_SHORTCUTS = 5;

// Per-entry shape stored: { filterName, filterLabel, value, valueLabel, negated? }
const keyOf = (f: { negated?: boolean; filterName: string; value: string }): string =>
  `${f.negated ? '!' : ''}${f.filterName}=${f.value}`;

function loadHistory(): Shortcut[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveHistory(history: Shortcut[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    /* quota / disabled — ignore */
  }
}

/**
 * Track newly-applied filters and surface the most recent unique ones as
 * shortcuts. `currentFilters` is the live filter array from FilterBuilder.
 * Returns the shortcut list to feed back into FilterBuilder's `shortcuts`
 * prop — currently-selected filters are excluded so we don't suggest
 * something already on screen.
 */
export function useFilterHistory(currentFilters: FilterItem[]): Shortcut[] {
  const [history, setHistory] = useState<Shortcut[]>(loadHistory);
  const prevRef = useRef<FilterItem[]>(currentFilters);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = currentFilters;

    const prevKeys = new Set(prev.map(keyOf));
    const added = currentFilters.filter((f) => !prevKeys.has(keyOf(f)));
    if (!added.length) return;

    setHistory((prevH) => {
      const additions: Shortcut[] = added.map((f) => ({
        filterName: f.filterName,
        filterLabel: f.filterLabel,
        value: f.value,
        valueLabel: f.valueLabel,
        negated: !!f.negated,
      }));
      const dedup = prevH.filter((h) => !additions.some((a) => keyOf(a) === keyOf(h)));
      const next = [...additions, ...dedup].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, [currentFilters]);

  const activeKeys = new Set(currentFilters.map(keyOf));
  return history.filter((h) => !activeKeys.has(keyOf(h))).slice(0, MAX_SHORTCUTS);
}
