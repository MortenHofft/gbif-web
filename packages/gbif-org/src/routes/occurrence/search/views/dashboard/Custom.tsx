import { useEffect, useMemo, useRef, useState } from 'react';
import isEqual from 'fast-deep-equal';
import { parse, print } from 'graphql';
import HighchartsReact from 'highcharts-react-official';
import { FormattedMessage } from 'react-intl';
import {
  BsArrowClockwise,
  BsArrowCounterclockwise,
  BsInfoCircleFill,
} from 'react-icons/bs';
import { MdWarning } from 'react-icons/md';
import { useConfig } from '@/config/config';
import { SearchInput } from '@/components/searchInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/smallCard';
import { CardHeader } from '@/components/dashboard/shared';
import Highcharts from '@/components/dashboard/charts/highcharts';
import MapView from './MapView';

type OutputKind = 'highcharts' | 'geojson';

type ChartEntry = {
  kind?: OutputKind;
  output: Record<string, unknown>;
  graphQuery: string;
  jqQuery: string;
  variables?: { predicate?: unknown };
};

type ChartConfigResponse = {
  query?: string;
  predicate?: unknown;
  charts: ChartEntry[];
};

type Props = {
  // Set once the user has submitted a query and the agent has produced a
  // chart. While unset the card renders an in-place form instead of trying
  // to fetch.
  queryId?: string;
  predicate?: unknown;
  // Merges a partial into the chart item's persistent params (item.p) on the
  // parent DashboardBuilder. Used here to write `queryId` back once the
  // agent responds, so reloads / layout-shares replay the same chart.
  setProps?: (partial: Record<string, unknown>) => void;
};

const normalize = (p: unknown) => (p === undefined ? null : p);

export default function CustomChart({ queryId, predicate, setProps }: Props) {
  if (!queryId) {
    return <CustomChartForm predicate={predicate} setProps={setProps} />;
  }
  return <CustomChartView queryId={queryId} predicate={predicate} />;
}

// In-place form shown until the user has submitted a query. Posts to
// /mcp/chart/query, then hands the returned queryId back via setProps so the
// parent re-renders this component with queryId set — which switches to
// CustomChartView and fetches the chart.
function CustomChartForm({
  predicate,
  setProps,
}: Pick<Props, 'predicate' | 'setProps'>) {
  const config = useConfig();
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);
  const mountedRef = useRef(true);
  // Assign true on every mount — useRef persists across remounts but doesn't
  // reset on its own, and under React strict mode (or a parent re-render
  // sequence that unmounts the form mid-fetch) the ref would otherwise stay
  // false forever, leaving setSubmitting(false) unreachable and the loader
  // spinning indefinitely.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function submit() {
    const q = value.trim();
    if (!q || submitting) return;
    setSubmitting(true);
    setHasError(false);
    try {
      const url = new URL(
        '/mcp/chart/query',
        config.graphqlEndpoint,
      ).toString();
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, predicate }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 500)}`);
      }
      const data = (await response.json()) as { queryId?: string };
      if (!mountedRef.current) return;
      if (typeof data.queryId !== 'string') {
        throw new Error('Server response missing queryId');
      }
      // Hands control back to the parent: setProps updates item.p; on the
      // next render we receive queryId and switch to CustomChartView.
      setProps?.({ queryId: data.queryId });
    } catch (err) {
      // Log the real reason to the console (so devs can see capacity
      // errors, 5xx bodies, network failures, etc.) but show only a
      // generic message in the UI.
      // eslint-disable-next-line no-console
      console.error('[chart] custom chart submit failed:', err);
      if (!mountedRef.current) return;
      setHasError(true);
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }

  return (
    <Card loading={submitting}>
      <CardHeader options={null}>
        <CardTitle>
          <FormattedMessage
            id="dashboard.customChart"
            defaultMessage="Custom chart"
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="g-text-sm g-text-slate-600 g-mb-2">
          <FormattedMessage
            id="dashboard.customChart.help"
            defaultMessage="Describe a chart or a map. The system will write a GraphQL query, transform it with jq, and render the result."
          />
        </p>
        <ul className="g-text-xs g-text-slate-500 g-list-disc g-list-inside g-mb-3 g-space-y-0.5">
          <li>breakdown by basis of record</li>
          <li>top 10 collection codes</li>
          <li>occurrences per year since 2000</li>
          <li>map coloured by latitude</li>
        </ul>
        <SearchInput
          className="g-w-full g-bg-white g-p-2 g-rounded-md g-border g-border-solid g-border-primary-500 g-text-sm"
          inputClassName="g-w-full"
          placeholder="Describe a chart…"
          value={value}
          disabled={submitting}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          onSearch={submit}
        />
        {hasError && (
          <div className="g-text-sm g-text-red-600 g-mt-2">
            <FormattedMessage
              id="dashboard.customChart.submitError"
              defaultMessage="Something went wrong while creating the chart. Please try again."
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Chart-render mode: fetches the saved chart config by queryId, supports
// refresh / restore-original, shows source provenance.
function CustomChartView({
  queryId,
  predicate,
}: Required<Pick<Props, 'queryId'>> & Pick<Props, 'predicate'>) {
  const config = useConfig();
  const [chartData, setChartData] = useState<ChartConfigResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [version, setVersion] = useState(0);
  const [showSource, setShowSource] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const url = new URL(
      `/mcp/chart/key/${encodeURIComponent(queryId)}`,
      config.graphqlEndpoint,
    ).toString();

    setLoading(true);
    setError(null);
    fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Failed to fetch chart (${response.status} ${response.statusText})`,
          );
        }
        return (await response.json()) as ChartConfigResponse;
      })
      .then((data) => {
        if (cancelled) return;
        setChartData(data);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [queryId, config.graphqlEndpoint, version]);

  async function refresh(withPredicate: unknown) {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      const url = new URL(
        `/mcp/chart/key/${encodeURIComponent(queryId)}/refresh`,
        config.graphqlEndpoint,
      ).toString();
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predicate: withPredicate ?? null }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(
          body.message || `Refresh failed (${response.status})`,
        );
      }
      setVersion((v) => v + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  const firstChart = chartData?.charts?.[0];
  const output = firstChart?.output;
  const kind: OutputKind = firstChart?.kind ?? 'highcharts';
  const originalPredicate = chartData?.predicate;
  const renderedPredicate = firstChart?.variables?.predicate;
  // Pretty-print the agent's GraphQL query. Falls back to the raw string if
  // it doesn't parse (e.g. a broken agent output we kept around for
  // debugging).
  const formattedGraphQuery = useMemo(() => {
    if (!firstChart?.graphQuery) return '';
    try {
      return print(parse(firstChart.graphQuery));
    } catch {
      return firstChart.graphQuery;
    }
  }, [firstChart?.graphQuery]);
  // Compare current dashboard predicate against the predicate that was used to
  // render the chart we're currently showing. After a refresh, this is the
  // refreshed predicate; before any refresh, it equals the original predicate.
  const filtersDiffer =
    chartData != null &&
    !isEqual(normalize(predicate), normalize(renderedPredicate));
  const isRestored =
    chartData != null &&
    isEqual(normalize(renderedPredicate), normalize(originalPredicate));

  const title = chartData?.query ?? (
    <FormattedMessage
      id="dashboard.customChart"
      defaultMessage="Custom chart"
    />
  );

  const headerActions = (
    <div>
      <Button
        variant="link"
        style={{ padding: '0 5px', height: 'auto' }}
        className={`g-m-0 ${showSource ? 'g-text-primary-500' : 'g-text-slate-400'}`}
        onClick={() => setShowSource((s) => !s)}
        title="Show source query"
      >
        <BsInfoCircleFill />
      </Button>
      <Button
        variant="link"
        style={{ padding: '0 5px', height: 'auto' }}
        className="g-m-0 g-text-slate-400"
        disabled={refreshing || loading}
        onClick={() => refresh(predicate)}
        title="Refresh with current filters"
      >
        <BsArrowClockwise />
      </Button>
      <Button
        variant="link"
        style={{ padding: '0 5px', height: 'auto' }}
        className="g-m-0 g-text-slate-400"
        disabled={refreshing || loading || isRestored}
        onClick={() => refresh(originalPredicate)}
        title="Restore original filters"
      >
        <BsArrowCounterclockwise />
      </Button>
    </div>
  );

  return (
    <Card loading={loading || refreshing} error={!!error}>
      <CardHeader options={headerActions}>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {error && !loading && (
          <div className="g-text-sm g-text-red-600 g-mb-2">{error}</div>
        )}

        {filtersDiffer && !error && (
          <div className="g-text-xs g-text-amber-800 g-bg-amber-50 g-border g-border-solid g-border-amber-200 g-rounded g-px-2 g-py-1 g-mb-2 g-flex g-items-center g-gap-1">
            <MdWarning className="g-flex-none" />
            <FormattedMessage
              id="dashboard.customChart.filtersChanged"
              defaultMessage="Filters have changed since this chart was built. Refresh to apply the current filters, or restore the original."
            />
          </div>
        )}

        {showSource && firstChart && (
          <div className="g-mb-2 g-text-xs">
            <details open>
              <summary className="g-cursor-pointer g-text-slate-500 g-mb-1">
                GraphQL
              </summary>
              <pre className="g-bg-slate-50 g-border g-border-solid g-border-slate-200 g-rounded g-p-2 g-font-mono g-overflow-x-auto">
                {formattedGraphQuery}
              </pre>
            </details>
            <details className="g-mt-1">
              <summary className="g-cursor-pointer g-text-slate-500 g-mb-1">
                jq
              </summary>
              <pre className="g-bg-slate-50 g-border g-border-solid g-border-slate-200 g-rounded g-p-2 g-font-mono g-overflow-x-auto g-whitespace-pre-wrap g-break-words">
                {firstChart.jqQuery}
              </pre>
            </details>
          </div>
        )}

        {!error && !loading && !output && (
          <div className="g-text-sm g-text-slate-500">
            <FormattedMessage
              id="dashboard.customChartEmpty"
              defaultMessage="No chart produced for this query."
            />
          </div>
        )}
        {!error && !loading && output && kind === 'geojson' && (
          <MapView geojson={output} />
        )}
        {!error && !loading && output && kind === 'highcharts' && (
          <HighchartsReact
            highcharts={Highcharts}
            options={output as Highcharts.Options}
          />
        )}
      </CardContent>
    </Card>
  );
}
