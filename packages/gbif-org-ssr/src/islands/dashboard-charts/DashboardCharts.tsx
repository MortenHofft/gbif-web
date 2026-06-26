import { useEffect, useState } from 'preact/hooks';
import { GraphQLService } from '../../lib/graphql';

// Same isomorphic GraphQL client the server uses — here it runs in the browser.
const OCCURRENCE_YEAR_FACET = /* GraphQL */ `
  query DatasetYearFacet($key: [JSON]) {
    occurrenceSearch(predicate: { type: in, key: "datasetKey", values: $key }) {
      documents {
        total
      }
      facet {
        year(size: 12) {
          key
          count
        }
      }
    }
  }
`;

type FacetBucket = { key: number; count: number };
type Result = {
  occurrenceSearch: {
    documents: { total: number };
    facet: { year: FacetBucket[] | null };
  } | null;
};

const numberFmt = new Intl.NumberFormat('en');

function clientGraphql(): GraphQLService {
  const endpoint =
    (window as { __GBIF__?: { graphqlEndpoint?: string } }).__GBIF__?.graphqlEndpoint ??
    'https://graphql.gbif.org/graphql';
  return new GraphQLService({ endpoint });
}

export function DashboardCharts({ datasetKey }: { datasetKey: string }) {
  const [state, setState] = useState<
    { phase: 'loading' } | { phase: 'error' } | { phase: 'ready'; total: number; buckets: FacetBucket[] }
  >({ phase: 'loading' });
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    clientGraphql()
      .query<Result>(OCCURRENCE_YEAR_FACET, { key: [datasetKey] })
      .then(({ data }) => {
        if (cancelled) return;
        const search = data?.occurrenceSearch;
        const buckets = (search?.facet.year ?? []).slice().sort((a, b) => a.key - b.key);
        setState({ phase: 'ready', total: search?.documents.total ?? 0, buckets });
      })
      .catch(() => !cancelled && setState({ phase: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [datasetKey]);

  if (state.phase === 'loading') {
    return <div class="flex h-56 items-center justify-center text-sm text-gray-400">Loading chart…</div>;
  }
  if (state.phase === 'error') {
    return <div class="flex h-56 items-center justify-center text-sm text-red-500">Could not load chart data.</div>;
  }
  if (state.buckets.length === 0) {
    return <div class="flex h-56 items-center justify-center text-sm text-gray-400">No dated occurrences.</div>;
  }

  const max = Math.max(...state.buckets.map((b) => b.count));

  return (
    <div>
      <p class="mb-3 text-sm text-gray-600">
        {numberFmt.format(state.total)} occurrences total
      </p>

      {/* Hand-rolled, dependency-free interactive bar chart (proves the island pattern;
          swap for a charting lib later). Each bar is a real button → click events. */}
      <div class="flex h-56 items-end gap-1" role="group" aria-label="Occurrences per year">
        {state.buckets.map((b) => {
          const isSel = selected === b.key;
          return (
            <button
              type="button"
              key={b.key}
              onClick={() => setSelected(isSel ? null : b.key)}
              title={`${b.key}: ${numberFmt.format(b.count)}`}
              aria-pressed={isSel}
              class={
                'group flex flex-1 flex-col items-center justify-end gap-1 rounded-t ' +
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500'
              }
            >
              <span
                class={
                  'w-full rounded-t transition-colors ' +
                  (isSel ? 'bg-emerald-600' : 'bg-emerald-300 group-hover:bg-emerald-400')
                }
                style={{ height: `${Math.max(2, (b.count / max) * 100)}%` }}
              />
              <span class="text-[10px] tabular-nums text-gray-500">{b.key}</span>
            </button>
          );
        })}
      </div>

      <div class="mt-4 min-h-[2.5rem] text-sm">
        {selected != null ? (
          <a
            class="text-emerald-700 hover:underline"
            href={`https://www.gbif.org/occurrence/search?dataset_key=${datasetKey}&year=${selected}`}
          >
            View {numberFmt.format(state.buckets.find((b) => b.key === selected)?.count ?? 0)}{' '}
            occurrences from {selected} →
          </a>
        ) : (
          <span class="text-gray-400">Select a year to drill down.</span>
        )}
      </div>
    </div>
  );
}
