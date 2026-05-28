import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

export function useNormalizedSearchParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  // setSearchParams is not stable across URL changes — it's recreated whenever
  // navigate changes. Mirror it through a ref so we can expose a stable setter.
  // https://github.com/remix-run/react-router/issues/9991
  const setSearchParamsRef = useRef(setSearchParams);
  useEffect(() => {
    setSearchParamsRef.current = setSearchParams;
  }, [setSearchParams]);

  const stableSetSearchParams = useCallback<typeof setSearchParams>(
    (...args) => setSearchParamsRef.current(...args),
    []
  );

  // Normalize params
  const normalized = useMemo(() => {
    const out = new URLSearchParams();
    let changed = false;

    for (const [key, value] of searchParams.entries()) {
      const camelKey = snakeToCamel(key);
      if (camelKey !== key) changed = true;
      out.append(camelKey, value);
    }

    return { params: out, changed };
  }, [searchParams]);

  // Sync URL once (replace, not push)
  useEffect(() => {
    if (normalized.changed) {
      stableSetSearchParams(normalized.params, { replace: true });
    }
  }, [normalized, stableSetSearchParams]);

  return [normalized.params, stableSetSearchParams] as const;
}
