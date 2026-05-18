import { ApolloServer } from 'apollo-server-express';
import { ExpressContext } from 'apollo-server-express/dist/ApolloServer';
import { McpError } from '../errors';
import { runChartFromAgentJson } from './runChartFromJson';
import { AgentResult } from './types';

// Provider-agnostic chat message. Each agent maps these onto its own wire
// format (OpenAI-shape messages, Gemini contents+systemInstruction, ...).
export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export interface LlmCallResult {
  text: string;
  // Model id as reported by the provider's response (may differ from the
  // configured model, e.g. version aliases). Optional; falls back to the
  // configured model in logs.
  rawModel?: string;
  usage?: unknown;
}

export interface LlmCaller {
  provider: string;
  // Configured model id (for logs / AgentResult.raw when the provider doesn't
  // report one in the response).
  model: string;
  call(messages: ChatMessage[]): Promise<LlmCallResult>;
}

interface RunWithRetryArgs {
  caller: LlmCaller;
  systemPrompt: string;
  userQuery: string;
  queryId: string;
  apolloServer: ApolloServer<ExpressContext>;
  // Total attempts including the initial call. Default 2 = one corrective
  // retry. Override via config.chartAgentMaxAttempts.
  maxAttempts?: number;
}

// Orchestrates the call-and-parse loop with self-correction. On the first
// failure the model's previous output plus the pipeline error are appended
// to the message history and we try again, up to maxAttempts total.
export async function runWithRetry({
  caller,
  systemPrompt,
  userQuery,
  queryId,
  apolloServer,
  maxAttempts = 2,
}: RunWithRetryArgs): Promise<AgentResult> {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userQuery },
  ];
  let lastError: McpError | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { text, rawModel, usage } = await caller.call(messages);
    try {
      return await runChartFromAgentJson({
        provider: caller.provider,
        model: rawModel ?? caller.model,
        usage,
        text,
        queryId,
        apolloServer,
      });
    } catch (err) {
      lastError =
        err instanceof McpError
          ? err
          : new McpError(
              err instanceof Error ? err.message : String(err),
              500,
            );
      if (attempt >= maxAttempts) throw lastError;
      // eslint-disable-next-line no-console
      console.warn(
        `[chart] ${caller.provider} attempt ${attempt}/${maxAttempts} failed, retrying:`,
        lastError.message,
      );
      messages.push({ role: 'assistant', content: text });
      messages.push({ role: 'user', content: buildFeedback(lastError) });
    }
  }

  // Unreachable: the loop either returns or throws above.
  throw (
    lastError ?? new McpError('Agent retry loop exited without result', 500)
  );
}

// Builds the corrective user message we feed back to the model. Includes the
// stage, the error, and just enough pipeline context for the model to fix its
// own output — without dumping the full GraphQL response.
function buildFeedback(err: McpError): string {
  const details = (err.details ?? {}) as Record<string, unknown>;
  const pipeline = (details.pipeline ?? {}) as Record<string, unknown>;
  const stage = (pipeline.stage as string | undefined) ?? (details.stage as string | undefined);

  const lines: string[] = [];
  lines.push('Your previous response failed.');
  if (stage) lines.push(`Stage: ${stage}`);
  lines.push(`Error: ${err.message}`);

  const graphQuery =
    (details.graphQuery as string | undefined) ??
    (pipeline.graphQuery as string | undefined);
  const jqQuery =
    (details.jqQuery as string | undefined) ??
    (pipeline.jqQuery as string | undefined);
  if (graphQuery) lines.push(`\nYour previous graphQuery:\n${graphQuery}`);
  if (jqQuery) lines.push(`\nYour previous jqQuery:\n${jqQuery}`);

  if (stage === 'jq' && pipeline.graphqlData) {
    lines.push(
      `\nFor reference, the GraphQL response had this shape (truncated):\n${truncate(
        JSON.stringify(pipeline.graphqlData, null, 2),
        2000,
      )}`,
    );
  }
  if (stage === 'graphql' && pipeline.errors) {
    lines.push(
      `\nGraphQL errors:\n${truncate(
        JSON.stringify(pipeline.errors, null, 2),
        1000,
      )}`,
    );
  }
  if (stage === 'parse-jq-output' && pipeline.jqOutput) {
    lines.push(
      `\nYour jq produced this non-JSON output:\n${truncate(
        String(pipeline.jqOutput),
        1000,
      )}`,
    );
  }
  if (stage === 'highcharts' && pipeline.chartOptions) {
    lines.push(
      `\nYour jq produced these Highcharts options:\n${truncate(
        JSON.stringify(pipeline.chartOptions, null, 2),
        1000,
      )}`,
    );
  }
  // JSON parse failure on the agent's own output (no pipeline ran).
  if (!graphQuery && typeof details.content === 'string') {
    lines.push(
      `\nYour raw response (which we could not parse as JSON):\n${truncate(details.content, 1000)}`,
    );
  }

  lines.push(
    '\nProduce a corrected JSON object with "graphQuery" and "jqQuery" string fields. Output ONLY the JSON object, no prose or code fences.',
  );
  return lines.join('\n');
}

function truncate(s: string, limit: number): string {
  return s.length > limit ? `${s.slice(0, limit)}\n...[truncated]` : s;
}
