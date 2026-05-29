import { searchParamsAtom } from '@/atoms/urlAtoms';
import { useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';
import { useCallback, useMemo } from 'react';

export function useUpdateViewParams(
  paramsToRemove = [] as string[],
  paramName = 'view'
): {
  params: URLSearchParams;
  getParams: (view?: string, defaultValue?: string) => URLSearchParams;
} {
  // Subscribe via jotai to a string-serialization of the current params
  // minus the ones we strip — this way the consumer only rerenders when
  // the relevant subset of params actually changes. `paramsToRemove` is
  // stabilized through observedKey because callers often pass a new array
  // literal each render.
  const observedKey = paramsToRemove.join('|');

  const slicedParamsAtom = useMemo(
    () =>
      selectAtom(
        searchParamsAtom,
        (raw): string => {
          const cloned = new URLSearchParams(raw);
          for (const p of paramsToRemove) cloned.delete(p);
          return cloned.toString();
        }
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [observedKey]
  );

  const slicedString = useAtomValue(slicedParamsAtom);

  const params = useMemo(() => new URLSearchParams(slicedString), [slicedString]);

  const getParams = useCallback(
    (view?: string, defaultValue?: string) => {
      const newSearchParams = new URLSearchParams(params);
      if (view && view !== defaultValue) {
        newSearchParams.set(paramName, view);
      } else {
        newSearchParams.delete(paramName);
      }
      return newSearchParams;
    },
    [params, paramName]
  );

  return {
    params,
    getParams,
  };
}
