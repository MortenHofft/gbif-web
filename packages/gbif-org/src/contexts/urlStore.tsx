import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useSearchParams } from 'react-router-dom';

// Per-key subscription to URL search params, bypassing react-router-dom's
// global rerender-on-any-URL-change behavior.
//
// react-router-dom v6 distributes useSearchParams via context, so every
// consumer rerenders whenever ANY url param changes. This store keeps a
// per-instance snapshot of URLSearchParams and notifies subscribers via
// useSyncExternalStore — but each subscriber only rerenders when its
// specific selector output changes (compared by string equality for the
// useUrlParam helper below).
//
// Read with useUrlParam('key'). Writes still go through react-router-dom
// (e.g. via useStringParam / useSearchParams.setSearchParams) — the
// UrlStoreProvider listens to useSearchParams and pushes the new snapshot
// into the store, so any path that updates the URL eventually wakes the
// right subscribers.

type Listener = () => void;

interface UrlStore {
  getSnapshot: () => URLSearchParams;
  setSnapshot: (next: URLSearchParams) => void;
  subscribe: (cb: Listener) => () => void;
}

function createUrlStore(initial: URLSearchParams): UrlStore {
  const listeners = new Set<Listener>();
  let current = initial;
  return {
    getSnapshot: () => current,
    setSnapshot: (next) => {
      if (next.toString() === current.toString()) return;
      current = next;
      listeners.forEach((l) => l());
    },
    subscribe: (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}

const UrlStoreContext = createContext<UrlStore | null>(null);

export function UrlStoreProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams();
  const [store] = useState(() => createUrlStore(searchParams));

  // This effect runs in the single provider whenever react-router pushes a
  // new searchParams instance. Consumers further down do NOT subscribe to
  // useSearchParams — they subscribe to the store with a key-scoped
  // selector, so they only wake when their key's value actually changes.
  useEffect(() => {
    store.setSnapshot(searchParams);
  }, [searchParams, store]);

  return <UrlStoreContext.Provider value={store}>{children}</UrlStoreContext.Provider>;
}

function useUrlStore(): UrlStore {
  const store = useContext(UrlStoreContext);
  if (!store) {
    throw new Error('useUrlValue/useUrlParam must be used inside <UrlStoreProvider>');
  }
  return store;
}

// Subscribe to a single URL param. Returns the raw string (or null).
// The component only rerenders when this specific key's value changes.
export function useUrlParam(key: string): string | null {
  const store = useUrlStore();
  // Stable getSnapshot for useSyncExternalStore — depends only on key.
  const getSnapshot = useCallback(() => store.getSnapshot().get(key), [store, key]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot) ?? null;
}

// Subscribe to a derived value computed from URL params. The selector must
// be referentially stable (wrap in useCallback) and should return values
// comparable by Object.is — return strings/numbers/booleans, not new
// objects, or supply your own isEqual cache wrapping the selector.
export function useUrlValue<T>(selector: (params: URLSearchParams) => T): T {
  const store = useUrlStore();

  // Cache the last result so identical computed values keep their reference
  // even when the underlying URLSearchParams instance changes.
  const cacheRef = useRef<{ params: URLSearchParams | null; value: T }>({
    params: null,
    value: undefined as unknown as T,
  });

  const getSnapshot = useCallback(() => {
    const params = store.getSnapshot();
    if (cacheRef.current.params === params) return cacheRef.current.value;
    const next = selector(params);
    if (cacheRef.current.params !== null && Object.is(next, cacheRef.current.value)) {
      cacheRef.current.params = params;
      return cacheRef.current.value;
    }
    cacheRef.current = { params, value: next };
    return next;
  }, [store, selector]);

  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

// Convenience: parse a string-valued param with a stable parser.
export function useParsedUrlParam<T>(key: string, parse: (raw: string | null) => T): T {
  const raw = useUrlParam(key);
  return useMemo(() => parse(raw), [raw, parse]);
}
