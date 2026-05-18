import { useEffect, useState } from 'react';
import isEqual from 'fast-deep-equal';
import HighchartsReact from 'highcharts-react-official';
import { FormattedMessage } from 'react-intl';
import { MdInfoOutline, MdRefresh, MdRestore, MdWarning } from 'react-icons/md';
import { useConfig } from '@/config/config';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/smallCard';
import Highcharts from '@/components/dashboard/charts/highcharts';

type ChartEntry = {
  chartOptions: Highcharts.Options;
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
  queryId?: string;
  predicate?: unknown;
};

const normalize = (p: unknown) => (p === undefined ? null : p);

export default function CustomChart({ queryId, predicate }: Props) {
  const config = useConfig();
  const [chartData, setChartData] = useState<ChartConfigResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [version, setVersion] = useState(0);
  const [showSource, setShowSource] = useState(false);

  useEffect(() => {
    if (!queryId) {
      setError('Missing queryId');
      setLoading(false);
      return;
    }

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
    if (!queryId || refreshing) return;
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
  const options = firstChart?.chartOptions;
  const originalPredicate = chartData?.predicate;
  const renderedPredicate = firstChart?.variables?.predicate;
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

  return (
    <Card loading={loading || refreshing} error={!!error}>
      <CardHeader className="g-flex-row g-justify-between g-items-start g-gap-2">
        <CardTitle className="g-flex-auto g-break-words">{title}</CardTitle>
        <div className="g-flex g-gap-0 g-flex-none g-text-slate-500">
          <Button
            variant="link"
            style={{ padding: '0 4px', height: 'auto' }}
            className={showSource ? 'g-text-primary-500' : ''}
            onClick={() => setShowSource((s) => !s)}
            title="Show source query"
          >
            <MdInfoOutline />
          </Button>
          <Button
            variant="link"
            style={{ padding: '0 4px', height: 'auto' }}
            disabled={refreshing || loading}
            onClick={() => refresh(predicate)}
            title="Refresh with current filters"
          >
            <MdRefresh />
          </Button>
          <Button
            variant="link"
            style={{ padding: '0 4px', height: 'auto' }}
            disabled={refreshing || loading || isRestored}
            onClick={() => refresh(originalPredicate)}
            title="Restore original filters"
          >
            <MdRestore />
          </Button>
        </div>
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
              <pre className="g-bg-slate-50 g-border g-border-solid g-border-slate-200 g-rounded g-p-2 g-font-mono g-overflow-x-auto g-whitespace-pre-wrap g-break-words">
                {firstChart.graphQuery}
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

        {!error && !loading && !options && (
          <div className="g-text-sm g-text-slate-500">
            <FormattedMessage
              id="dashboard.customChartEmpty"
              defaultMessage="No chart produced for this query."
            />
          </div>
        )}
        {!error && !loading && options && (
          <HighchartsReact highcharts={Highcharts} options={options} />
        )}
      </CardContent>
    </Card>
  );
}
