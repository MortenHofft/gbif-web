import NodeCache from 'node-cache';

export type Predicate = unknown;

export type OutputKind = 'highcharts' | 'geojson';

export interface ChartEntry {
  // What this entry's `output` is. Drives the validator (server side) and
  // the renderer (frontend).
  kind: OutputKind;
  // 'highcharts': a Highcharts options object.
  // 'geojson': a GeoJSON FeatureCollection (RFC 7946) with simplestyle-spec
  //            properties on each feature (marker-color, stroke, fill, ...).
  output: Record<string, unknown>;
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

export function addChart(queryId: string, chart: ChartEntry): void {
  const existing = chartCache.get<ChartConfig>(queryId);
  const obj: ChartConfig = existing ?? { charts: [] };
  obj.charts = obj.charts || [];
  obj.charts.push(chart);
  chartCache.set(queryId, obj);
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

type ValidationResult = { valid: true } | { valid: false; error: string };

// Dispatcher: kind decides which validator to run.
export function validateOutput(
  kind: OutputKind,
  value: unknown,
): ValidationResult {
  if (kind === 'geojson') return validateGeoJson(value);
  return validateHighchartsOptions(value);
}

// Minimal shape check for a Highcharts options object. Doesn't validate every
// nested option (Highcharts has hundreds), just that the basic structure looks
// plausible.
function validateHighchartsOptions(value: unknown): ValidationResult {
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

// Minimal shape check for a GeoJSON FeatureCollection (RFC 7946). Doesn't
// validate every coordinate-ring rule, just that the top-level structure
// matches what the frontend renderer expects.
function validateGeoJson(value: unknown): ValidationResult {
  if (!value || typeof value !== 'object') {
    return { valid: false, error: 'GeoJSON output must be an object' };
  }
  const obj = value as Record<string, unknown>;
  if (obj.type !== 'FeatureCollection') {
    return {
      valid: false,
      error: 'GeoJSON output must be a FeatureCollection (type: "FeatureCollection")',
    };
  }
  if (!Array.isArray(obj.features)) {
    return { valid: false, error: '"features" must be an array' };
  }
  // Spot-check the first feature so obvious shape mistakes surface here, not
  // silently in the browser.
  const first = obj.features[0] as Record<string, unknown> | undefined;
  if (first && first.type !== 'Feature') {
    return {
      valid: false,
      error: 'Each entry in "features" must have type: "Feature"',
    };
  }
  if (first && (!first.geometry || typeof first.geometry !== 'object')) {
    return {
      valid: false,
      error: 'Each feature must have a "geometry" object',
    };
  }
  return { valid: true };
}
