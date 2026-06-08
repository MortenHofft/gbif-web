export class McpError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.name = 'McpError';
    this.status = status;
    this.details = details;
  }
}

// Refusal codes the chart agent may emit instead of a chart/map config.
// Threaded all the way back to the browser (top-level `code` on the HTTP
// error response) so the client can show a tailored message.
//   NOT_A_CHART                — the query isn't a visualization request, or
//                                is unrelated to GBIF occurrence data.
//   UNABLE_TO_FIND_RELEVANT_DATA — a meaningful visualization request, but
//                                we don't hold the requested data (e.g.
//                                "breakdown by age of observer").
export const CHART_REFUSAL_CODES = [
  'NOT_A_CHART',
  'UNABLE_TO_FIND_RELEVANT_DATA',
] as const;

export type ChartRefusalCode = typeof CHART_REFUSAL_CODES[number];

export function isChartRefusalCode(value: unknown): value is ChartRefusalCode {
  return (
    typeof value === 'string' &&
    (CHART_REFUSAL_CODES as readonly string[]).includes(value)
  );
}

// A deliberate, well-formed refusal from the agent — NOT a malformed-output
// failure. Distinguished from a plain McpError so runWithRetry can skip the
// corrective retry loop (there is nothing to correct) and so chart.ctrl.ts
// can surface the `code` to the client. Uses HTTP 422 (Unprocessable Entity):
// the request was understood but cannot be fulfilled.
export class ChartRefusalError extends McpError {
  code: ChartRefusalCode;

  constructor(
    code: ChartRefusalCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message, 422, { code, ...(details ?? {}) });
    this.name = 'ChartRefusalError';
    this.code = code;
  }
}
