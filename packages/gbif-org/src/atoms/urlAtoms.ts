import { atom } from 'jotai';
import { selectAtom } from 'jotai/utils';

// Jotai-based URL state. The base atom holds the latest URLSearchParams
// snapshot — it is fed by <JotaiUrlSync> mounted near the route root,
// which mirrors react-router-dom's useSearchParams into the atom.
//
// Reads use per-key derived atoms produced by `urlParamAtom('foo')`.
// `selectAtom` compares the selected value with Object.is, so a consumer
// only rerenders when its specific param value changes — not on every
// URL update. Writes still go through react-router-dom (useStringParam,
// useSearchParams.setSearchParams, etc.); JotaiUrlSync picks the change
// up and propagates it.

export const searchParamsAtom = atom<URLSearchParams>(new URLSearchParams());

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
