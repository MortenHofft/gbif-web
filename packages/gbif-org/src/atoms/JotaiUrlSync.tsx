import { useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { useLocation, useMatches, useSearchParams } from 'react-router-dom';
import { matchesAtom, pathnameAtom, searchParamsAtom, setSearchParamsAtom } from './urlAtoms';

const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

// Mount once inside a jotai <Provider> that scopes the URL store for the
// subtree. It subscribes to react-router's useSearchParams (which is the
// source of truth for navigation) and:
//   1. Mirrors each new URLSearchParams instance into searchParamsAtom.
//   2. Publishes the latest setSearchParams into setSearchParamsAtom so
//      hooks that want to write the URL without subscribing to URL
//      context can read the setter imperatively via store.get(...).
//   3. Normalizes snake_case keys to camelCase by rewriting the URL once
//      (replacement, no history entry). Preserves the historical
//      behaviour of useNormalizedSearchParams but applies globally.
//
// Renders nothing.
export function JotaiUrlSync(): null {
  const location = useLocation();
  const matches = useMatches();
  const [searchParams, setSearchParams] = useSearchParams();
  const setParams = useSetAtom(searchParamsAtom);
  const setPathname = useSetAtom(pathnameAtom);
  const setMatches = useSetAtom(matchesAtom);
  const setSetter = useSetAtom(setSearchParamsAtom);

  useEffect(() => {
    setParams(searchParams);
  }, [searchParams, setParams]);

  // Dep is a primitive string, so this effect only fires when pathname
  // actually changes — search-param updates don't trigger it.
  useEffect(() => {
    setPathname(location.pathname);
  }, [location.pathname, setPathname]);

  // Matches array reference changes on every URL update, but content
  // (route ids/params) only changes on route navigations. Consumers
  // dedupe downstream with selectAtom equality.
  useEffect(() => {
    setMatches(matches);
  }, [matches, setMatches]);

  // Wrap in a thunk to prevent jotai's "setter accepts function updater"
  // shorthand from invoking setSearchParams with the previous value.
  useEffect(() => {
    setSetter(() => setSearchParams);
  }, [setSearchParams, setSetter]);

  // One-shot URL normalization: snake_case → camelCase. Cheap to check
  // (single pass over keys); replaces the URL only when something changed.
  useEffect(() => {
    let changed = false;
    const normalized = new URLSearchParams();
    for (const [k, v] of searchParams.entries()) {
      const camel = snakeToCamel(k);
      if (camel !== k) changed = true;
      normalized.append(camel, v);
    }
    if (changed) {
      setSearchParams(normalized, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return null;
}
