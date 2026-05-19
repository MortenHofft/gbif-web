import { ApolloServer } from 'apollo-server-express';
import { ExpressContext } from 'apollo-server-express/dist/ApolloServer';
import rawConfig from '@/config';
import { McpError } from '../errors';
import { runChartFromAgentJson } from './runChartFromJson';
import { AgentResult } from './types';

const config = rawConfig as typeof rawConfig & {
  chartAgentMaxAttempts?: number;
};

// Total attempts including the initial call. 2 = one corrective retry.
// Override per environment via chartAgentMaxAttempts in .env.
const DEFAULT_MAX_ATTEMPTS = 2;

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
}

// Orchestrates the call-and-parse loop with self-correction. On the first
// failure the model's previous output plus the pipeline error are appended
// to the message history and we try again, up to chartAgentMaxAttempts total.
export async function runWithRetry({
  caller,
  systemPrompt,
  userQuery,
  queryId,
  apolloServer,
}: RunWithRetryArgs): Promise<AgentResult> {
  const maxAttempts = config.chartAgentMaxAttempts ?? DEFAULT_MAX_ATTEMPTS;
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

// -----------------------------------------------------------------------------
// Corrective feedback messages.
//
// Each pipeline stage has its own helper that turns the error details into a
// short, focused note. The dispatch table makes it easy to add stages and
// keeps the per-stage hints next to the stage they describe.
// -----------------------------------------------------------------------------

type Details = Record<string, unknown>;

const truncate = (s: string, limit: number) =>
  s.length > limit ? `${s.slice(0, limit)}\n...[truncated]` : s;

const stringField = (d: Details, key: string): string | undefined =>
  typeof d[key] === 'string' ? (d[key] as string) : undefined;

const stageFeedbackers: Record<string, (d: Details, err: McpError) => string[]> = {
  jq: (d, err) => {
    const lines: string[] = [];
    if (d.graphqlData) {
      lines.push(
        `For reference, the GraphQL response had this shape (truncated):\n${truncate(
          JSON.stringify(d.graphqlData, null, 2),
          2000,
        )}`,
      );
    }
    // Targeted hints for jq quoting mistakes. Small models inherit the
    // single-quote habit from Python/JS-flavoured training data; the jq error
    // ("Unix shell quoting issues?") is misleading enough that a generic retry
    // doesn't fix it.
    const jqQuery = stringField(d, 'jqQuery');
    if (jqQuery && /'[^']*'/.test(jqQuery)) {
      lines.push(
        "IMPORTANT: your jq uses single quotes ('...'), which are NOT valid in jq. Replace EVERY single-quoted string with a double-quoted string (\"...\").",
      );
    } else if (/Unix shell quoting|INVALID_CHARACTER/.test(err.message)) {
      lines.push(
        'IMPORTANT: jq strings must use double quotes ("..."). If you used any other quote style, switch to double quotes.',
      );
    }
    return lines;
  },
  graphql: (d) =>
    d.errors
      ? [`GraphQL errors:\n${truncate(JSON.stringify(d.errors, null, 2), 1000)}`]
      : [],
  'parse-jq-output': (d) =>
    d.jqOutput
      ? [`Your jq produced this non-JSON output:\n${truncate(String(d.jqOutput), 1000)}`]
      : [],
  highcharts: (d) =>
    d.chartOptions
      ? [
          `Your jq produced these Highcharts options:\n${truncate(
            JSON.stringify(d.chartOptions, null, 2),
            1000,
          )}`,
        ]
      : [],
  'agent-json-parse': (d) =>
    typeof d.content === 'string'
      ? [`Your raw response (which we could not parse as JSON):\n${truncate(d.content, 1000)}`]
      : [],
};

// Builds the corrective user message we feed back to the model. Includes the
// stage, the error, and just enough pipeline context for the model to fix its
// own output — without dumping the full GraphQL response.
function buildFeedback(err: McpError): string {
  const d = (err.details ?? {}) as Details;
  const stage = stringField(d, 'stage');
  const graphQuery = stringField(d, 'graphQuery');
  const jqQuery = stringField(d, 'jqQuery');

  const lines: string[] = ['Your previous response failed.'];
  if (stage) lines.push(`Stage: ${stage}`);
  lines.push(`Error: ${err.message}`);
  if (graphQuery) lines.push(`\nYour previous graphQuery:\n${graphQuery}`);
  if (jqQuery) lines.push(`\nYour previous jqQuery:\n${jqQuery}`);

  const stageHints = stage ? stageFeedbackers[stage]?.(d, err) ?? [] : [];
  for (const hint of stageHints) {
    lines.push(`\n${hint}`);
  }

  lines.push(
    '\nProduce a corrected JSON object with "graphQuery" and "jqQuery" string fields. Output ONLY the JSON object, no prose or code fences.',
  );
  return lines.join('\n');
}
