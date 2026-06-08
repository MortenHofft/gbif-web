import { ChartRefusalError, isChartRefusalCode, McpError } from '../errors';
import { executeChart } from '../executeChart';
import { setLlmResponse } from '../store';
import { AgentResult } from './types';

// Fallback user-facing text per refusal code, used when the model returns the
// code but no (or an empty) "message" field.
const REFUSAL_FALLBACK_MESSAGE: Record<string, string> = {
  NOT_A_CHART:
    "That doesn't look like a request for a chart or a map of GBIF occurrence data.",
  UNABLE_TO_FIND_RELEVANT_DATA:
    "We don't have the data needed to answer that question.",
};

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
    // Fallback: scan for the first balanced { ... } and parse that.
    // Tolerates trailing junk like an accidental extra closing brace
    // (Gemini's constrained JSON decoding occasionally trips when the
    // inner jqQuery string ends in `}` and the model loses brace depth),
    // explanatory text after the JSON, or stray code fences.
    const extracted = extractFirstJsonObject(text);
    if (extracted) {
      try {
        parsed = JSON.parse(extracted);
        // eslint-disable-next-line no-console
        console.warn(
          `[chart] ${provider} JSON parse recovered via balanced-brace extraction (${
            text.length - extracted.length
          } extraneous chars)`,
        );
      } catch {
        // fall through to the throw below
      }
    }
    if (parsed === undefined) {
      throw new McpError(
        `${provider} output is not valid JSON: ${text.slice(0, 300)}`,
        502,
        {
          provider,
          model,
          stage: 'agent-json-parse',
          content: truncateForDetails(text),
        },
      );
    }
  }

  const obj = parsed as {
    kind?: unknown;
    graphQuery?: unknown;
    jqQuery?: unknown;
    error?: unknown;
    message?: unknown;
  };

  // The model can deliberately refuse rather than emit a chart config — either
  // the query isn't a visualization request (NOT_A_CHART) or we don't hold the
  // requested data (UNABLE_TO_FIND_RELEVANT_DATA). This is a valid, terminal
  // answer: throw a ChartRefusalError so runWithRetry skips the corrective
  // retry loop and chart.ctrl.ts surfaces the code to the client.
  if (isChartRefusalCode(obj.error)) {
    const message =
      typeof obj.message === 'string' && obj.message.trim().length > 0
        ? obj.message
        : REFUSAL_FALLBACK_MESSAGE[obj.error];
    throw new ChartRefusalError(obj.error, message, {
      provider,
      model,
      llmResponse: text,
    });
  }

  if (typeof obj.graphQuery !== 'string' || typeof obj.jqQuery !== 'string') {
    throw new McpError(
      `${provider} response missing string graphQuery or jqQuery`,
      502,
      {
        provider,
        model,
        stage: 'agent-shape',
        parsed: truncateForDetails(parsed),
      },
    );
  }
  // kind is optional for back-compat; defaults to highcharts.
  const kind =
    obj.kind === 'geojson' || obj.kind === 'highcharts'
      ? obj.kind
      : 'highcharts';

  // Wrap executeChart errors so the agent's provider/model context is
  // attached alongside the pipeline-stage details. Flatten the inner
  // details rather than nesting under `pipeline`, so consumers (HTTP
  // client, retry feedback builder) see one consistent shape:
  //   { provider, model, usage, stage, graphQuery, jqQuery, variables, ... }
  try {
    const { timings } = await executeChart({
      graphQuery: obj.graphQuery,
      jqQuery: obj.jqQuery,
      kind,
      queryId,
    });
    // Persist the exact model output so the browser debug panel (served from
    // GET /chart/key/:key) can always show what the LLM actually returned.
    setLlmResponse(queryId, text);
    return {
      provider,
      raw: {
        model,
        usage,
        kind,
        graphQuery: obj.graphQuery,
        jqQuery: obj.jqQuery,
        // The agent's exact, unparsed output. Always included in the debug
        // payload returned to the browser.
        llmResponse: text,
        // Pipeline-stage timings. runWithRetry will add llmMs / attempts /
        // totalMs alongside these before returning to the client.
        timings,
      },
    };
  } catch (err) {
    const inner = err instanceof McpError ? err : undefined;
    const innerDetails = (inner?.details ?? {}) as Record<string, unknown>;
    throw new McpError(
      err instanceof Error ? err.message : String(err),
      inner?.status ?? 500,
      { provider, model, usage, kind, ...innerDetails },
    );
  }
}

// Trim potentially-huge model outputs (stuck-in-a-loop responses can be
// tens of kilobytes of recursive garbage) before stuffing them into the
// HTTP error response. Returns the value unchanged if small; otherwise
// returns a truncated JSON-stringified preview tagged with the original
// length so the consumer knows it was cut.
const MAX_DETAIL_LEN = 2000;
function truncateForDetails(value: unknown): unknown {
  let s: string;
  try {
    s = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return '[unserialisable]';
  }

  if (!s || s.length <= MAX_DETAIL_LEN) return value;
  return `${s.slice(0, MAX_DETAIL_LEN)}\n...[truncated, ${
    s.length
  } total chars]`;
}

// Finds the first balanced { ... } in text, respecting JSON string literals
// (so a { or } inside a string doesn't shift the depth count). Returns the
// substring including the outer braces, or null if no balanced object is
// found. Used as a JSON.parse fallback when the model emits valid JSON but
// also some trailing garbage.
function extractFirstJsonObject(text: string): string | null {
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\') {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1);
      }
      if (depth < 0) return null;
    }
  }
  return null;
}
