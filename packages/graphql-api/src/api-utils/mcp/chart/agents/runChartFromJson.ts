import { ApolloServer } from 'apollo-server-express';
import { ExpressContext } from 'apollo-server-express/dist/ApolloServer';
import { McpError } from '../errors';
import { executeChart } from '../executeChart';
import { AgentResult } from './types';

export interface RunChartFromJsonArgs {
  // Identifier used in logs and AgentResult.provider (e.g. 'mistral', 'gemini').
  provider: string;
  // Model id reported by the provider; surfaced in AgentResult.raw.
  model?: string;
  // Provider-specific usage object; surfaced in AgentResult.raw.
  usage?: unknown;
  // The agent's raw output. Expected to be a JSON object with the shape
  // { graphQuery: string, jqQuery: string }.
  text: string;
  queryId: string;
  apolloServer: ApolloServer<ExpressContext>;
}

// Shared step that every chart agent shares once it has the model's text
// output: parse JSON, validate the { graphQuery, jqQuery } shape, run the
// GraphQL + jq + Highcharts pipeline, return the AgentResult. All failures
// are thrown as McpError with `details` flattened so the HTTP response and
// the corrective retry feedback both consume a single shape.
export async function runChartFromAgentJson({
  provider,
  model,
  usage,
  text,
  queryId,
  apolloServer,
}: RunChartFromJsonArgs): Promise<AgentResult> {
  // eslint-disable-next-line no-console
  console.log(`[chart] ${provider} raw response`, {
    model,
    usage,
    content: text,
  });

  if (typeof text !== 'string' || text.length === 0) {
    throw new McpError(`${provider} returned no message content`, 502, {
      provider,
      model,
      stage: 'agent-empty',
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new McpError(
      `${provider} output is not valid JSON: ${text.slice(0, 300)}`,
      502,
      { provider, model, stage: 'agent-json-parse', content: text },
    );
  }

  const obj = parsed as { graphQuery?: unknown; jqQuery?: unknown };
  if (typeof obj.graphQuery !== 'string' || typeof obj.jqQuery !== 'string') {
    throw new McpError(
      `${provider} response missing string graphQuery or jqQuery`,
      502,
      { provider, model, stage: 'agent-shape', parsed },
    );
  }

  // Wrap executeChart errors so the agent's provider/model context is
  // attached alongside the pipeline-stage details. Flatten the inner
  // details rather than nesting under `pipeline`, so consumers (HTTP
  // client, retry feedback builder) see one consistent shape:
  //   { provider, model, usage, stage, graphQuery, jqQuery, variables, ... }
  try {
    await executeChart({
      graphQuery: obj.graphQuery,
      jqQuery: obj.jqQuery,
      queryId,
      apolloServer,
    });
    return {
      provider,
      raw: { model, usage, graphQuery: obj.graphQuery, jqQuery: obj.jqQuery },
    };
  } catch (err) {
    const inner = err instanceof McpError ? err : undefined;
    const innerDetails = (inner?.details ?? {}) as Record<string, unknown>;
    throw new McpError(
      err instanceof Error ? err.message : String(err),
      inner?.status ?? 500,
      { provider, model, usage, ...innerDetails },
    );
  }
}
