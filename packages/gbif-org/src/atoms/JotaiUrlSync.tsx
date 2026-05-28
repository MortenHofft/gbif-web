import { useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchParamsAtom } from './urlAtoms';

// Mount once inside a jotai <Provider> that scopes the URL store for the
// subtree. It subscribes to react-router's useSearchParams (which is the
// source of truth for navigation) and mirrors each new instance into the
// jotai base atom. Per-key consumers via urlParamAtom('foo') then only
// rerender when their specific value changes.
//
// Renders nothing.
export function JotaiUrlSync(): null {
  const [searchParams] = useSearchParams();
  const setParams = useSetAtom(searchParamsAtom);
  useEffect(() => {
    setParams(searchParams);
  }, [searchParams, setParams]);
  return null;
}
