import { useEffect, useState } from 'react';
import HighchartsReact from 'highcharts-react-official';
import { FormattedMessage } from 'react-intl';
import { useConfig } from '@/config/config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/smallCard';
import Highcharts from '@/components/dashboard/charts/highcharts';

type ChartEntry = {
  chartOptions: Highcharts.Options;
};

type ChartConfigResponse = {
  query?: string;
  charts: ChartEntry[];
};

type Props = {
  queryId?: string;
};

export default function CustomChart({ queryId }: Props) {
  const config = useConfig();
  const [chartData, setChartData] = useState<ChartConfigResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
  }, [queryId, config.graphqlEndpoint]);

  const options = chartData?.charts?.[0]?.chartOptions;
  const title = chartData?.query ?? (
    <FormattedMessage id="dashboard.customChart" defaultMessage="Custom chart" />
  );

  return (
    <Card loading={loading} error={!!error}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {error && !loading && (
          <div className="g-text-sm g-text-red-600">{error}</div>
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
