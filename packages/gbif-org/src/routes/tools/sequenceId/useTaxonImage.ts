import { useEffect, useState } from 'react';
import { apiConstants } from '@/config/apiConstants';

export type TaxonImage = {
  identifier: string;
  occurrenceKey?: string;
  rightsHolder?: string;
  license?: string;
};

type CacheEntry = {
  promise: Promise<TaxonImage | null>;
  value?: TaxonImage | null;
};

const cache = new Map<string, CacheEntry>();

function fetchTaxonImage(
  checklistKey: string,
  taxonKey: number | string
): Promise<TaxonImage | null> {
  const key = `${checklistKey}:${taxonKey}`;
  const existing = cache.get(key);
  if (existing) return existing.promise;

  const url = `${apiConstants.v1Endpoint}/occurrence/experimental/multimedia/species/${encodeURIComponent(
    checklistKey
  )}/${encodeURIComponent(String(taxonKey))}?mediaType=stillImage&limit=1&offset=0`;

  const promise = fetch(url)
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const first = data?.results?.[0];
      const value: TaxonImage | null = first?.identifier
        ? {
            identifier: first.identifier,
            occurrenceKey: first.occurrenceKey,
            rightsHolder: first.rightsHolder,
            license: first.license,
          }
        : null;
      const entry = cache.get(key);
      if (entry) entry.value = value;
      return value;
    })
    .catch(() => {
      const entry = cache.get(key);
      if (entry) entry.value = null;
      return null;
    });

  cache.set(key, { promise });
  return promise;
}

export function useTaxonImage(
  checklistKey: string | undefined,
  taxonKey: number | string | undefined
): { image: TaxonImage | null; loading: boolean } {
  const key = checklistKey && taxonKey != null ? `${checklistKey}:${taxonKey}` : null;
  const cached = key ? cache.get(key) : undefined;
  const initial = cached && 'value' in cached ? cached.value ?? null : null;
  const [image, setImage] = useState<TaxonImage | null>(initial);
  const [loading, setLoading] = useState<boolean>(!!key && !(cached && 'value' in cached));

  useEffect(() => {
    if (!checklistKey || taxonKey == null) {
      setImage(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchTaxonImage(checklistKey, taxonKey).then((value) => {
      if (cancelled) return;
      setImage(value);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [checklistKey, taxonKey]);

  return { image, loading };
}
