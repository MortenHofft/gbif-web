import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'gbif:omni-filter-history:v1';
const MAX_HISTORY = 30;
export const MAX_SHORTCUTS = 5;

export type HistoryEntry = {
  handle: string; // filter handle, e.g. "basisOfRecord"
  filterLabel: string; // translated filter name, e.g. "Basis of record"
  value: unknown; // raw predicate to apply via FilterContext.add
  valueLabel: string; // human-readable value, used in the dropdown row
  negated: boolean;
};

export const keyOf = (e: { handle: string; value: unknown; negated: boolean }) =>
  `${e.negated ? '!' : ''}${e.handle}=${stableJSON(e.value)}`;

export function stableJSON(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(',')}]`;
  const keys = Object.keys(value as object).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableJSON((value as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}

function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveHistory(history: HistoryEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // quota / disabled — ignore
  }
}

export function useFilterHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);

  const record = useCallback((entry: HistoryEntry) => {
    setHistory((prev) => {
      const k = keyOf(entry);
      const without = prev.filter((h) => keyOf(h) !== k);
      const next = [entry, ...without].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, []);

  // Re-load from storage when the tab regains focus, so two tabs stay in sync.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onFocus = () => setHistory(loadHistory());
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  return { history, record };
}
