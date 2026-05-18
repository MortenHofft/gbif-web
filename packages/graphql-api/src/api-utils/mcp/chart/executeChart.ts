import { ApolloServer } from 'apollo-server-express';
import { ExpressContext } from 'apollo-server-express/dist/ApolloServer';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jq = require('node-jq');
import { McpError } from './errors';
import { addChart, getChartConfig, validateHighchartsOptions } from './store';

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
  const variables = {
    language: 'eng',
    predicate,
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
    // node-jq mutates its input; copy first.
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

  const chartId = addChart(queryId, {
    chartOptions,
    graphQuery,
    jqQuery,
    graphqlData: response,
    variables,
  });

  return { chartId, chartOptions };
}
