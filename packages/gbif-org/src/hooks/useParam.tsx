import { searchParamsAtom, setSearchParamsAtom, urlParamAtom } from '@/atoms/urlAtoms';
import { useAtomValue, useStore } from 'jotai';
import { Base64 } from 'js-base64';
import { useCallback, useMemo } from 'react';

type Options<T> = {
  key: string;
  defaultValue?: T;
  hideDefault?: boolean;
  preventScrollReset?: boolean;
  replace?: boolean;
};

// hook to get and set number param from url
const numberParser = (str?: string) => parseFloat(str ?? '0');
export function useNumberParam(
  options: Options<string | number>
): [number, (value: number) => void] {
  const [value, setValue] = useParam({
    ...options,
    defaultValue: options.defaultValue ?? 0,
    parse: numberParser,
  });
  return [value, setValue];
}

const intParser = (str?: string) => parseInt(str ?? '0');
export function useIntParam(options: Options<number>): [number, (value: number) => void] {
  const [value, setValue] = useParam({
    ...options,
    defaultValue: options.defaultValue ?? 0,
    parse: intParser,
  });

  return [value, setValue];
}

const stringParser = (str?: string) => str;
export function useStringParam(
  options: Options<string>
): [string | undefined, (value?: string) => void] {
  const [value, setValue] = useParam({
    ...options,
    parse: stringParser,
  });
  return [value, setValue];
}

const jsonParser = (obj?: string) => {
  if (!obj) return undefined;
  try {
    const value = obj ? Base64.decode(obj) : obj;
    const parsedValue = JSON.parse(value);
    return parsedValue;
  } catch (err) {
    return undefined;
  }
};
const jsonEncoder = (v?: object) => {
  try {
    const encoded = Base64.encode(JSON.stringify(v));
    return encoded;
  } catch (err) {
    return undefined;
  }
};

export function useJsonParam(
  options: Options<object>
): [object | undefined, (value: object) => void] {
  const [value, setValue] = useParam({
    ...options,
    defaultValue: jsonEncoder(options.defaultValue),
    parse: jsonParser,
    serialize: jsonEncoder,
  });
  return [value, setValue];
}

export function useParam<T>({
  key,
  parse,
  serialize,
  defaultValue,
  hideDefault,
  replace,
  preventScrollReset = true,
}: {
  key: string;
  parse: (value?: string) => T;
  serialize?: (value?: T) => string | undefined;
  defaultValue?: string | number;
  hideDefault?: boolean;
  replace?: boolean;
  preventScrollReset?: boolean;
}): [T, (value: T) => void] {
  // Per-key subscription via the URL store — the consumer only rerenders
  // when this specific key's serialized value changes. Other URL updates
  // (pagination of an unrelated key, different filter, etc.) don't wake it.
  const rawFromUrl = useAtomValue(urlParamAtom(key));
  const rawValue = rawFromUrl ?? (defaultValue ? defaultValue.toString() : undefined);
  const value = useMemo(() => parse(rawValue), [rawValue, parse]);

  // Writes go through react-router's setSearchParams pulled imperatively
  // from the jotai store — so this hook does NOT subscribe to the router's
  // URL context just to obtain the setter.
  const store = useStore();
  const setValue = useCallback(
    (next: T) => {
      const setSearchParams = store.get(setSearchParamsAtom);
      if (!setSearchParams) return; // JotaiUrlSync not yet mounted
      const clone = new URLSearchParams(store.get(searchParamsAtom));
      const serializedValue = typeof serialize === 'function' ? serialize(next) : next + '';
      clone.set(key, serializedValue + '');
      if (next === undefined || (next === defaultValue && hideDefault)) {
        clone.delete(key);
      }
      setSearchParams(clone, { replace, preventScrollReset });
    },
    [store, key, serialize, defaultValue, hideDefault, replace, preventScrollReset]
  );

  return [value, setValue];
}
