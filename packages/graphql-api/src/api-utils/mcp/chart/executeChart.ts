import { ApolloServer } from 'apollo-server-express';
import { ExpressContext } from 'apollo-server-express/dist/ApolloServer';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jq = require('node-jq');
import { McpError } from './errors';
import {
  addChart,
  ChartEntry,
  getChartConfig,
  setChartEntry,
  validateHighchartsOptions,
} from './store';

interface RunChartArgs {
  graphQuery: string;
  jqQuery: string;
  predicate: unknown;
  apolloServer: ApolloServer<ExpressContext>;
}

interface RunChartResult {
  chartOptions: Record<string, unknown>;
  graphqlData: unknown;
  variables: Record<string, unknown>;
}

// Shared core: run the GraphQL query, pipe through jq, validate the
// Highcharts options. No store mutation — callers decide where the result
// lands (executeChart appends a new entry; refreshChart replaces one).
async function runChart({
  graphQuery,
  jqQuery,
  predicate,
  apolloServer,
}: RunChartArgs): Promise<RunChartResult> {
  const variables = {
    language: 'eng',
    predicate: predicate ?? null,
    size: 50,
    from: 0,
  };

  let response: { data?: unknown; errors?: ReadonlyArray<{ message: string }> };
  try {
    response = await apolloServer.executeOperation({
      query: graphQuery,
      variables,
    });
  } catch (error) {
    throw new McpError(
      `Failed to execute GraphQL query: ${(error as Error).message}`,
      500,
    );
  }

  if (response.errors && response.errors.length > 0) {
    const messages = response.errors.map((e) => e.message).join(', ');
    throw new McpError(`GraphQL query errors: ${messages}`, 400);
  }

  let jqResult: string;
  try {
    const clean = JSON.parse(JSON.stringify(response));
    jqResult = await jq.run(jqQuery, clean, { input: 'json' });
  } catch (error) {
    throw new McpError(`jq failed: ${(error as Error).message}`, 400);
  }

  let chartOptions: Record<string, unknown>;
  try {
    chartOptions = JSON.parse(jqResult);
  } catch (error) {
    throw new McpError(
      `jq output is not valid JSON: ${(error as Error).message}`,
      400,
    );
  }

  const validation = validateHighchartsOptions(chartOptions);
  if (!validation.valid) {
    throw new McpError(`Invalid Highcharts options: ${validation.error}`, 400);
  }

  return { chartOptions, graphqlData: response, variables };
}

interface ExecuteChartArgs {
  graphQuery: string;
  jqQuery: string;
  queryId: string;
  apolloServer: ApolloServer<ExpressContext>;
}

export interface ExecuteChartResult {
  chartId: string;
  chartOptions: Record<string, unknown>;
}

export async function executeChart({
  graphQuery,
  jqQuery,
  queryId,
  apolloServer,
}: ExecuteChartArgs): Promise<ExecuteChartResult> {
  const chartConfig = getChartConfig(queryId);
  const predicate = chartConfig?.predicate ?? null;
  const { chartOptions, graphqlData, variables } = await runChart({
    graphQuery,
    jqQuery,
    predicate,
    apolloServer,
  });
  const chartId = addChart(queryId, {
    chartOptions,
    graphQuery,
    jqQuery,
    graphqlData,
    variables,
  });
  return { chartId, chartOptions };
}

interface RefreshChartArgs {
  queryId: string;
  predicate: unknown;
  apolloServer: ApolloServer<ExpressContext>;
}

// Re-runs the stored graphQuery + jqQuery for a chart against a new predicate
// and replaces `charts[0]`. The ChartConfig's top-level `predicate` (the
// original) is intentionally left untouched so the UI can still offer
// "restore original".
export async function refreshChart({
  queryId,
  predicate,
  apolloServer,
}: RefreshChartArgs): Promise<ChartEntry> {
  const config = getChartConfig(queryId);
  if (!config) {
    throw new McpError(`Chart config not found for queryId ${queryId}`, 404);
  }
  const existing = config.charts?.[0];
  if (!existing) {
    throw new McpError(`No chart to refresh for queryId ${queryId}`, 400);
  }
  const { chartOptions, graphqlData, variables } = await runChart({
    graphQuery: existing.graphQuery,
    jqQuery: existing.jqQuery,
    predicate,
    apolloServer,
  });
  const updated: ChartEntry = {
    ...existing,
    chartOptions,
    graphqlData,
    variables,
  };
  setChartEntry(queryId, 0, updated);
  return updated;
}
