import NodeCache from 'node-cache';
import Ajv, { ValidateFunction } from 'ajv';

export type Predicate = unknown;

export interface ChartEntry {
  vegaspecs: Record<string, unknown>;
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

let schemaValidator: ValidateFunction | null = null;

async function getSchemaValidator(): Promise<ValidateFunction> {
  if (!schemaValidator) {
    const response = await fetch(
      'https://vega.github.io/schema/vega-lite/v5.json',
    );
    const schema = await response.json();
    const ajv = new Ajv({ strict: false, allErrors: false });
    schemaValidator = ajv.compile(schema);
  }
  return schemaValidator;
}

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

export async function validateVegaLiteSpec(
  spec: unknown,
): Promise<
  { valid: true } | { valid: false; errors?: unknown; error?: string }
> {
  try {
    const validate = await getSchemaValidator();
    const valid = validate(spec);
    if (!valid) return { valid: false, errors: validate.errors };
    return { valid: true };
  } catch (error) {
    return { valid: false, error: (error as Error).message };
  }
}
