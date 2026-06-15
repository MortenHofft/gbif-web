import { useEffect, useState } from 'react';
import { FormattedNumber } from 'react-intl';

type Props = {
  countPart: string;
  placeholder?: React.ReactNode;
};

export function CountResolver({ countPart, placeholder }: Props) {
  if (isAbsoluteEndpoint(countPart) || isRelativeEndpoint(countPart)) {
    return <CountFetcher countPart={countPart} placeholder={placeholder} />;
  }

  return <FormattedNumber value={Number(countPart)} />;
}

function CountFetcher({ countPart, placeholder }: Props) {
  const [count, setCount] = useState<string | null>(null);

  useEffect(() => {
    const endpoint = createEndpoint(countPart);

    fetch(endpoint)
      .then((response) => response.json() as Promise<unknown>)
      .then((result) => {
        const count = extractCountFromResult(result);
        setCount(count);
      })
      .catch((error) => console.error(error));
  }, [countPart]);

  if (count === null) {
    return placeholder;
  }

  return <FormattedNumber value={Number(count)} />;
}

const isAbsoluteEndpoint = (countPart: string) => countPart.startsWith('http');

const isRelativeEndpoint = (countPart: string) => countPart.startsWith('/api/');

const createEndpoint = (countPart: string): string => {
  // Absolute URLs and relative /api/ endpoints (e.g. the /api/resource/search proxy)
  // are used as-is so the request goes through our own backend rather than hitting
  // the content search API directly from the browser.
  if (isAbsoluteEndpoint(countPart)) return countPart;
  if (isRelativeEndpoint(countPart)) return countPart;
  // Fallback: a bare query string is routed through the resource search proxy.
  const queryParams = countPart.split('?')[1];
  return `/api/resource/search?${queryParams}`;
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const extractCountFromResult = (result: unknown): string | null => {
  if (!isObject(result)) return null;
  if ('count' in result && typeof result.count === 'number') {
    return result.count.toString();
  }
  if (
    'documents' in result &&
    isObject(result.documents) &&
    'total' in result.documents &&
    typeof result.documents.total === 'number'
  ) {
    return result.documents.total.toString();
  }
  return null;
};
