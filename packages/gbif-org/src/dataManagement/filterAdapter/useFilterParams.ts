import { searchParamsAtom, setSearchParamsAtom } from '@/atoms/urlAtoms';
import { asStringParams, ParamQuery, parseParams } from '@/utils/querystring';
import { useAtomValue, useStore } from 'jotai';
import { selectAtom } from 'jotai/utils';
import { Base64 } from 'js-base64';
import isPlainObject from 'lodash/isPlainObject';
import objectHash from 'object-hash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { filter2v1 } from '.';
import { cleanUpFilter, FilterType } from '../../contexts/filter';
import { FilterConfigType } from './filter2predicate';
import v12filter from './v12filter';

export function useFilterParams({
  filterConfig,
  defaultChecklistKey,
  paramsToRemove,
}: {
  filterConfig: FilterConfigType;
  defaultChecklistKey?: string;
  paramsToRemove: string[];
}): [FilterType, (filter: FilterType) => void] {
  const [remove] = useState(paramsToRemove ?? []);
  const [emptyQuery, setEmptyQuery] = useState({});
  const [observedParams, setObservedParams] = useState<string[]>([]);
  const [query, setQuery] = useQueryParams({ observedParams });

  // create an empty map to use as overwrites when a param is present in updates.
  // this simply generates a map with all keys set to undefined, but only the keys that are defined in the filterConfig
  // this way we won't have meddle with params that are not our business.
  useEffect(() => {
    const fields = filterConfig?.fields ?? {};
    if (!isPlainObject(fields)) return;
    setObservedParams([
      ...Object.keys(fields).map((x) => fields?.[x]?.defaultKey ?? x),
      'filter',
      'checklistKey',
    ]);

    const empty: { [key: string]: undefined } = [
      ...Object.keys(fields),
      'checklistKey',
      ...remove,
    ].reduce((accumulator: { [key: string]: undefined }, curr: string) => {
      const fieldConfig = fields[curr];
      accumulator[fieldConfig?.defaultKey || curr] = undefined;
      return accumulator;
    }, {});
    empty.filter = undefined;
    setEmptyQuery(empty);
  }, [filterConfig, remove]);

  // Transform the query from the url to the naming the consumer prefers.
  // Field names can change according to the configuration
  const filter = useMemo(() => {
    let f;
    if (query?.filter) {
      const encodedFilter = Array.isArray(query.filter) ? query.filter[0] : query.filter;
      f = Base64JsonParam.decode(encodedFilter);
    } else {
      f = v12filter(query, filterConfig, defaultChecklistKey);
    }
    return f;
  }, [query, filterConfig, defaultChecklistKey]);

  // transform the filter to a string that can go into the url.
  // Field names can change according to the configuration
  const setFilter = useCallback(
    (nextFilter: FilterType) => {
      if (objectHash(cleanUpFilter(nextFilter)) === objectHash(cleanUpFilter(filter))) {
        return;
      }
      const { filter: v1Filter, errors } = filter2v1(nextFilter, filterConfig);
      if (v1Filter && v1Filter?.checklistKey === defaultChecklistKey) {
        delete v1Filter.checklistKey;
      }
      if (errors) {
        // if we cannot serialize the filter to version 1 API, then just serialize the json and put it in the filter param
        setQuery({ ...emptyQuery, filter: Base64JsonParam.encode(nextFilter) });
      } else {
        setQuery({ ...emptyQuery, ...v1Filter });
      }
    },
    [filterConfig, emptyQuery, filter, setQuery]
  );

  return [filter, setFilter];
}

const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

// Reads only the URL params whose (camel-normalized) key appears in
// observedParams, returning the parseParams-shaped Record. The slice is
// subscribed to via jotai with an object-hash equality check, so the
// caller only rerenders when one of the observed values actually changes
// — not on every URL update.
//
// updateQuery writes back to the URL via react-router's setSearchParams,
// which is pulled imperatively from setSearchParamsAtom (populated by
// JotaiUrlSync). That keeps this hook free of useSearchParams /
// useLocation / useNavigate subscriptions; nothing here wakes on
// unrelated URL changes.
function useQueryParams({ observedParams }: { observedParams: string[] }) {
  // Stabilize the dependency: observedParams may be a new array reference
  // each render even when its contents are identical.
  const observedKey = observedParams.join('');

  const sliceAtom = useMemo(
    () => {
      const observed = new Set(observedParams);
      return selectAtom(
        searchParamsAtom,
        (params): ParamQuery => {
          const filtered = new URLSearchParams();
          for (const [rawKey, value] of params.entries()) {
            const key = snakeToCamel(rawKey);
            if (observed.has(key)) filtered.append(key, value);
          }
          return parseParams(filtered, true);
        },
        // Slice values are Records of arrays; identity is recreated each
        // selector run, so we need a deep equality. Hash is microseconds
        // for filter-sized slices and only runs on URL changes.
        (a, b) => objectHash(a) === objectHash(b)
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [observedKey]
  );

  const query = useAtomValue(sliceAtom);

  // Read the latest URL state imperatively for merge — does NOT
  // subscribe the caller to URL changes.
  const store = useStore();
  const updateQuery = useCallback(
    (nextQuery: ParamQuery) => {
      const setSearchParams = store.get(setSearchParamsAtom);
      if (!setSearchParams) return; // JotaiUrlSync not mounted yet
      const existingQuery = parseParams(store.get(searchParamsAtom), true);
      const mergedQuery = { ...existingQuery, ...nextQuery };
      setSearchParams(asStringParams(mergedQuery), { preventScrollReset: true });
    },
    [store]
  );

  return [query, updateQuery] as [ParamQuery, (query: ParamQuery) => void];
}

export const Base64JsonParam = {
  encode: (obj: object) => (obj ? Base64.encode(JSON.stringify(obj)) : undefined),
  decode: (obj: string) => {
    try {
      const value = obj ? Base64.decode(obj) : obj;
      const parsedValue = JSON.parse(value);
      return parsedValue;
    } catch (err) {
      return undefined;
    }
  },
};

export default Base64JsonParam;
