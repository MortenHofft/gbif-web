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
}

// Orchestrates the call-and-parse loop with self-correction. On the first
// failure the model's previous output plus the pipeline error are appended
// to the message history and we try again, up to chartAgentMaxAttempts total.
//
// Wraps each caller.call with timing and accumulates llmMs across attempts.
// On success, merges llm + total + attempts numbers into the AgentResult's
// raw.timings (which already carries graphqlMs / jqMs from executeChart) so
// the client sees one combined timings object.
export async function runWithRetry({
  caller,
  systemPrompt,
  userQuery,
  queryId,
}: RunWithRetryArgs): Promise<AgentResult> {
  const maxAttempts = config.chartAgentMaxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userQuery },
  ];
  let lastError: McpError | undefined;
  let llmTotalMs = 0;
  const startMs = Date.now();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const llmStart = Date.now();
    const { text, rawModel, usage } = await caller.call(messages);
    llmTotalMs += Date.now() - llmStart;
    try {
      const result = await runChartFromAgentJson({
        provider: caller.provider,
        model: rawModel ?? caller.model,
        usage,
        text,
        queryId,
      });
      const existingTimings =
        ((result.raw as { timings?: Record<string, unknown> } | undefined)
          ?.timings ?? {}) as Record<string, unknown>;
      return {
        ...result,
        raw: {
          ...(result.raw as Record<string, unknown>),
          timings: {
            ...existingTimings,
            llmMs: llmTotalMs,
            attempts: attempt,
            totalMs: Date.now() - startMs,
          },
        },
      };
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
      const feedback = buildFeedback(lastError);
      // Log the corrective message we're about to send. This is what the
      // model actually sees on the retry; if it's not landing the fix,
      // grep here first to verify the GraphQL error / jq output / etc.
      // is being forwarded.
      // eslint-disable-next-line no-console
      console.warn(
        `[chart] ${caller.provider} retry feedback:\n${
          feedback.length > 2000
            ? feedback.slice(0, 2000) + `\n...[truncated, ${feedback.length} total chars]`
            : feedback
        }`,
      );
      messages.push({ role: 'assistant', content: text });
      messages.push({ role: 'user', content: feedback });
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
    } else if (
      /unexpected\s+\/\//i.test(err.message) ||
      (jqQuery && /\{[^{}]*:\s*[^()]*\/\/[^()]*[,}]/.test(jqQuery))
    ) {
      // jq's `//` (alternative) operator is fine on its own but becomes a
      // syntax error when used unparenthesized as an object-literal value
      // (it clashes with the `,` separator). Tell the model to wrap it.
      lines.push(
        'IMPORTANT: jq\'s `//` (alternative) operator must be parenthesised when used as an object value. Write `{ name: (.label // .key) }`, NOT `{ name: .label // .key }`. The same applies to any compound expression (if/then/end, expressions containing `,` or `|`) used as an object-literal value.',
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
    d.output
      ? [
          `Your jq produced these Highcharts options:\n${truncate(
            JSON.stringify(d.output, null, 2),
            1000,
          )}`,
        ]
      : [],
  geojson: (d) =>
    d.output
      ? [
          `Your jq produced this GeoJSON (must be a FeatureCollection with a "features" array; coordinates are [longitude, latitude]):\n${truncate(
            JSON.stringify(d.output, null, 2),
            1000,
          )}`,
        ]
      : [],
  'agent-json-parse': (d) =>
    typeof d.content === 'string'
      ? [`Your raw response (which we could not parse as JSON):\n${truncate(d.content, 1000)}`]
      : [],
  // Fires when the model returned a JSON object but the shape is wrong —
  // typically `jqQuery` came back as a nested JSON object instead of a string
  // of jq source code (model confusion between "build the chart options" and
  // "build a jq program that builds the chart options").
  'agent-shape': (d) => {
    const lines = [
      'IMPORTANT: "graphQuery" and "jqQuery" MUST be STRING fields. "jqQuery" contains jq SOURCE CODE as text — not the Highcharts options object itself, and not nested JSON. For example: "jqQuery": "{ chart: { type: \\"pie\\" }, series: [{ ... }] }". The host runs your jq source against the GraphQL response to produce the actual chart/map output.',
    ];
    if (d.parsed !== undefined) {
      const repr =
        typeof d.parsed === 'string'
          ? d.parsed
          : JSON.stringify(d.parsed, null, 2);
      lines.push(`Your previous response (truncated):\n${truncate(repr, 1000)}`);
    }
    return lines;
  },
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

// Node's fetch throws errors with the very terse message "fetch failed";
// the actual reason (DNS lookup failure, ECONNREFUSED, expired cert,
// timeout, etc.) lives in error.cause. Surface it so the api log and the
// HTTP error response don't lose the diagnostic.
export function wrapFetchError(
  provider: string,
  model: string,
  error: unknown,
): McpError {
  const e = error as Error & {
    cause?: { code?: string; message?: string; errno?: number };
  };
  const causeBits: string[] = [];
  if (e?.cause?.code) causeBits.push(e.cause.code);
  if (e?.cause?.message && e.cause.message !== e.message)
    causeBits.push(e.cause.message);
  const causeStr = causeBits.length > 0 ? ` (${causeBits.join(': ')})` : '';
  return new McpError(
    `${provider} API request failed: ${e?.message ?? String(error)}${causeStr}`,
    502,
    {
      provider,
      model,
      stage: 'network',
      cause: e?.cause,
    },
  );
}
