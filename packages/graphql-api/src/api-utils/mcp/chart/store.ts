import NodeCache from 'node-cache';

export type Predicate = unknown;

export interface ChartEntry {
  chartOptions: Record<string, unknown>;
  graphQuery: string;
  jqQuery: string;
  graphqlData: unknown;
  variables: Record<string, unknown>;
}

export interface ChartConfig {
  predicate?: Predicate;
  query?: string;
  charts: ChartEntry[];
}

const chartCache = new NodeCache({ stdTTL: 1200, checkperiod: 40 });

export function createChartConfig(queryId: string, value: ChartConfig): void {
  chartCache.set(queryId, value);
}

export function getChartConfig(key: string): ChartConfig | undefined {
  return chartCache.get<ChartConfig>(key);
}

export function getAllKeys(): string[] {
  return chartCache.keys();
}

export function addChart(queryId: string, chart: ChartEntry): string {
  const existing = chartCache.get<ChartConfig>(queryId);
  const obj: ChartConfig = existing ?? { charts: [] };
  obj.charts = obj.charts || [];
  obj.charts.push(chart);
  chartCache.set(queryId, obj);
  return queryId;
}

export function setChartEntry(
  queryId: string,
  index: number,
  chart: ChartEntry,
): void {
  const existing = chartCache.get<ChartConfig>(queryId);
  if (!existing) {
    throw new Error(`No chart config for queryId ${queryId}`);
  }
  existing.charts = existing.charts ?? [];
  existing.charts[index] = chart;
  chartCache.set(queryId, existing);
}

// Minimal shape check for a Highcharts options object. Doesn't validate every
// nested option (Highcharts has hundreds), just that the basic structure looks
// plausible.
export function validateHighchartsOptions(
  value: unknown,
): { valid: true } | { valid: false; error: string } {
  if (!value || typeof value !== 'object') {
    return { valid: false, error: 'Chart options must be an object' };
  }
  const obj = value as Record<string, unknown>;
  if (!('series' in obj) && !('chart' in obj)) {
    return {
      valid: false,
      error: 'Chart options must include at least a "series" or "chart" field',
    };
  }
  if ('series' in obj && !Array.isArray(obj.series)) {
    return { valid: false, error: '"series" must be an array' };
  }
  return { valid: true };
}
