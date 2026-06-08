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
  // The agent's exact, unparsed text output for this query. Persisted so the
  // browser debug panel (GET /chart/key/:key) can always show what the LLM
  // actually returned, alongside the parsed graphQuery / jqQuery.
  llmResponse?: string;
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

// Records the agent's raw text output on the config so the browser debug
// panel can surface it. Best-effort: silently no-ops if the config has
// expired out of the cache (the chart already failed in that case).
export function setLlmResponse(queryId: string, text: string): void {
  const existing = chartCache.get<ChartConfig>(queryId);
  if (!existing) return;
  existing.llmResponse = text;
  chartCache.set(queryId, existing);
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
      error:
        'GeoJSON output must be a FeatureCollection (type: "FeatureCollection")',
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
  // Optional legend: a foreign member describing what the marker colours
  // encode. RFC 7946 §6.1 permits foreign members; the frontend renders this
  // as an overlay when present.
  if ('legend' in obj && obj.legend !== undefined && obj.legend !== null) {
    const legend = obj.legend as Record<string, unknown>;
    if (typeof legend !== 'object') {
      return { valid: false, error: '"legend" must be an object' };
    }
    if (!Array.isArray(legend.items)) {
      return { valid: false, error: '"legend.items" must be an array' };
    }
    const firstItem = legend.items[0] as Record<string, unknown> | undefined;
    if (
      firstItem &&
      (typeof firstItem.label !== 'string' ||
        typeof firstItem.color !== 'string')
    ) {
      return {
        valid: false,
        error: 'Each legend item must have string "label" and "color" fields',
      };
    }
  }
  return { valid: true };
}
