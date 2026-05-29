import { atom } from 'jotai';
import { selectAtom } from 'jotai/utils';
import type { SetURLSearchParams } from 'react-router-dom';

// Jotai-based URL state. The base atom holds the latest URLSearchParams
// snapshot — it is fed by <JotaiUrlSync> mounted near the route root,
// which mirrors react-router-dom's useSearchParams into the atom.
//
// Reads use per-key derived atoms produced by `urlParamAtom('foo')`.
// `selectAtom` compares the selected value with Object.is, so a consumer
// only rerenders when its specific param value changes — not on every
// URL update. Writes still go through react-router-dom; JotaiUrlSync
// publishes its setSearchParams setter via setSearchParamsAtom so
// hooks that don't want to subscribe to the URL context can read the
// latest setter imperatively (store.get(setSearchParamsAtom)).

export const searchParamsAtom = atom<URLSearchParams>(new URLSearchParams());

// Pathname mirror, populated by JotaiUrlSync. Consumers can subscribe via
// useAtomValue(pathnameAtom) to rerender only on pathname changes,
// ignoring search-param updates. Initial value is empty on SSR/first
// render; JotaiUrlSync's effect populates it once it mounts.
export const pathnameAtom = atom<string>('');

// Mirrors react-router's setSearchParams. Populated by JotaiUrlSync.
// Read imperatively from a jotai store (store.get(setSearchParamsAtom));
// do NOT use useAtomValue or you'll resubscribe on every URL change.
export const setSearchParamsAtom = atom<SetURLSearchParams | null>(null);

const urlParamAtomCache = new Map<string, ReturnType<typeof urlParamAtomFor>>();

function urlParamAtomFor(key: string) {
  return selectAtom(searchParamsAtom, (params) => params.get(key) ?? null);
}

// Cached so repeated calls with the same key return the SAME atom — jotai
// uses atom identity to deduplicate subscriptions.
export function urlParamAtom(key: string) {
  let a = urlParamAtomCache.get(key);
  if (!a) {
    a = urlParamAtomFor(key);
    urlParamAtomCache.set(key, a);
  }
  return a;
}
