import { ApolloServer } from 'apollo-server-express';
import { ExpressContext } from 'apollo-server-express/dist/ApolloServer';
import { parse as parseGraphql } from 'graphql';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jq = require('node-jq');
import { McpError } from './errors';
import {
  addChart,
  ChartEntry,
  getChartConfig,
  OutputKind,
  setChartEntry,
  validateOutput,
} from './store';

// Small LLMs occasionally produce GraphQL with the right structure but a
// missing closing brace at the end (lost track of nesting depth). Burning a
// retry on this is wasteful when the fix is mechanical and the graphql-js
// parser will tell us whether the candidate is syntactic. Try appending 1–5
// closing braces; return the first variant that parses cleanly, or null if
// the input is already valid or unrepairable. Logged when it fires so we can
// see frequency.
function tryRepairGraphQuery(query: string): string | null {
  try {
    parseGraphql(query);
    return null;
  } catch {
    /* fall through to repair attempts */
  }
  for (let n = 1; n <= 5; n++) {
    const candidate = query + '}'.repeat(n);
    try {
      parseGraphql(candidate);
      return candidate;
    } catch {
      /* try next */
    }
  }
  return null;
}

interface RunChartArgs {
  graphQuery: string;
  jqQuery: string;
  kind: OutputKind;
  predicate: unknown;
  apolloServer: ApolloServer<ExpressContext>;
}

// Pipeline-stage timings in milliseconds. Surfaced through ExecuteChartResult
// and refreshChart, then merged into AgentResult.raw.timings by runWithRetry
// so the HTTP client can see "where did the slow seconds go".
export interface PipelineTimings {
  graphqlMs: number;
  jqMs: number;
}

interface RunChartResult {
  output: Record<string, unknown>;
  graphqlData: unknown;
  variables: Record<string, unknown>;
  timings: PipelineTimings;
  // The graphQuery that was actually executed — possibly differs from the
  // input if tryRepairGraphQuery had to append closing braces. Callers should
  // persist this version so the source panel and refresh both work with what
  // actually ran, not the broken original.
  graphQuery: string;
}

// Each McpError thrown from this module carries the same details shape so
// downstream code (chart.ctrl.ts → HTTP response; llmCall.ts → corrective
// retry feedback) can rely on it.
function pipelineError(
  message: string,
  status: number,
  stage: string,
  graphQuery: string,
  jqQuery: string,
  variables: Record<string, unknown>,
  extras: Record<string, unknown> = {},
): McpError {
  // eslint-disable-next-line no-console
  console.error(`[chart] runChart failed at stage ${stage}: ${message}`);
  // For the noisiest stages also dump the structured payload — schema
  // validation errors, jq output, etc. — so dev tails see what the model
  // actually produced and what apollo / node-jq said in response.
  if (stage === 'graphql' && extras.errors) {
    // eslint-disable-next-line no-console
    console.error(
      `[chart] graphql errors:\n${JSON.stringify(extras.errors, null, 2)}`,
    );
  }
  if (stage === 'parse-jq-output' && extras.jqOutput) {
    // eslint-disable-next-line no-console
    console.error(`[chart] jq output:\n${String(extras.jqOutput).slice(0, 2000)}`);
  }
  return new McpError(message, status, {
    stage,
    graphQuery,
    jqQuery,
    variables,
    ...extras,
  });
}

// Shared core: run the GraphQL query, pipe through jq, validate the output
// (Highcharts options or GeoJSON, depending on `kind`). No store mutation —
// callers decide where the result lands (executeChart appends a new entry;
// refreshChart replaces one).
async function runChart({
  graphQuery,
  jqQuery,
  kind,
  predicate,
  apolloServer,
}: RunChartArgs): Promise<RunChartResult> {
  const variables = {
    language: 'eng',
    predicate: predicate ?? null,
    size: 50,
    from: 0,
  };

  // Best-effort syntactic repair before sending to Apollo. Saves a retry
  // round-trip on the common "model forgot a closing brace" failure mode.
  const repaired = tryRepairGraphQuery(graphQuery);
  if (repaired) {
    // eslint-disable-next-line no-console
    console.warn(
      `[chart] graphQuery auto-repaired (+${repaired.length - graphQuery.length} chars). Original missing closing brace(s).`,
    );
    graphQuery = repaired;
  }

  let response: { data?: unknown; errors?: ReadonlyArray<{ message: string }> };
  const graphqlStart = Date.now();
  try {
    response = await apolloServer.executeOperation({
      query: graphQuery,
      variables,
    });
  } catch (error) {
    throw pipelineError(
      `Failed to execute GraphQL query: ${(error as Error).message}`,
      500,
      'graphql',
      graphQuery,
      jqQuery,
      variables,
      { reason: (error as Error).message },
    );
  }
  const graphqlMs = Date.now() - graphqlStart;

  if (response.errors && response.errors.length > 0) {
    const messages = response.errors.map((e) => e.message).join(', ');
    throw pipelineError(
      `GraphQL query errors: ${messages}`,
      400,
      'graphql',
      graphQuery,
      jqQuery,
      variables,
      { errors: response.errors },
    );
  }

  let jqResult: string;
  const jqStart = Date.now();
  try {
    const clean = JSON.parse(JSON.stringify(response));
    jqResult = await jq.run(jqQuery, clean, { input: 'json' });
  } catch (error) {
    throw pipelineError(
      `jq failed: ${(error as Error).message}`,
      400,
      'jq',
      graphQuery,
      jqQuery,
      variables,
      { reason: (error as Error).message, graphqlData: response },
    );
  }
  const jqMs = Date.now() - jqStart;

  let output: Record<string, unknown>;
  try {
    output = JSON.parse(jqResult);
  } catch (error) {
    throw pipelineError(
      `jq output is not valid JSON: ${(error as Error).message}`,
      400,
      'parse-jq-output',
      graphQuery,
      jqQuery,
      variables,
      { jqOutput: jqResult },
    );
  }

  const validation = validateOutput(kind, output);
  if (!validation.valid) {
    throw pipelineError(
      `Invalid ${kind} output: ${validation.error}`,
      400,
      kind === 'geojson' ? 'geojson' : 'highcharts',
      graphQuery,
      jqQuery,
      variables,
      { output, reason: validation.error },
    );
  }

  return {
    output,
    graphqlData: response,
    variables,
    timings: { graphqlMs, jqMs },
    graphQuery,
  };
}

interface ExecuteChartArgs {
  graphQuery: string;
  jqQuery: string;
  // Defaults to 'highcharts' for callers (e.g. older agent flows) that don't
  // emit a kind.
  kind?: OutputKind;
  queryId: string;
  apolloServer: ApolloServer<ExpressContext>;
}

export interface ExecuteChartResult {
  kind: OutputKind;
  output: Record<string, unknown>;
  timings: PipelineTimings;
}

export async function executeChart({
  graphQuery,
  jqQuery,
  kind = 'highcharts',
  queryId,
  apolloServer,
}: ExecuteChartArgs): Promise<ExecuteChartResult> {
  const chartConfig = getChartConfig(queryId);
  const predicate = chartConfig?.predicate ?? null;
  const {
    output,
    graphqlData,
    variables,
    timings,
    graphQuery: executedGraphQuery,
  } = await runChart({
    graphQuery,
    jqQuery,
    kind,
    predicate,
    apolloServer,
  });
  addChart(queryId, {
    kind,
    output,
    // Store the version that actually ran (may differ from input if
    // tryRepairGraphQuery had to append closing braces), so the source
    // panel and refresh/restore work with what was executed.
    graphQuery: executedGraphQuery,
    jqQuery,
    graphqlData,
    variables,
  });
  return { kind, output, timings };
}

interface RefreshChartArgs {
  queryId: string;
  predicate: unknown;
  apolloServer: ApolloServer<ExpressContext>;
}

export interface RefreshChartResult {
  entry: ChartEntry;
  timings: PipelineTimings;
}

// Re-runs the stored graphQuery + jqQuery for a chart against a new predicate
// and replaces `charts[0]`. The ChartConfig's top-level `predicate` (the
// original) is intentionally left untouched so the UI can still offer
// "restore original". Kind is read from the existing entry.
export async function refreshChart({
  queryId,
  predicate,
  apolloServer,
}: RefreshChartArgs): Promise<RefreshChartResult> {
  const config = getChartConfig(queryId);
  if (!config) {
    throw new McpError(`Chart config not found for queryId ${queryId}`, 404);
  }
  const existing = config.charts?.[0];
  if (!existing) {
    throw new McpError(`No chart to refresh for queryId ${queryId}`, 400);
  }
  const {
    output,
    graphqlData,
    variables,
    timings,
    graphQuery: executedGraphQuery,
  } = await runChart({
    graphQuery: existing.graphQuery,
    jqQuery: existing.jqQuery,
    kind: existing.kind,
    predicate,
    apolloServer,
  });
  const updated: ChartEntry = {
    ...existing,
    output,
    // Pick up any in-flight syntactic repair; the stored entry is usually
    // already-valid so this is a no-op, but kept for symmetry with
    // executeChart.
    graphQuery: executedGraphQuery,
    graphqlData,
    variables,
  };
  setChartEntry(queryId, 0, updated);
  return { entry: updated, timings };
}
