import { McpError } from '../errors';
import { executeChart } from '../executeChart';
import { AgentArgs, AgentResult } from './types';

export interface ChatAgentArgs extends AgentArgs {
  // Identifier used in logs and AgentResult.provider.
  provider: string;
  // Chat-completions URL (OpenAI / Mistral / Groq / OpenRouter / ...).
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  // Request `response_format: { type: 'json_object' }`. Most modern providers
  // and chat models support it; leave false for ones that don't.
  jsonObject?: boolean;
  temperature?: number;
  maxTokens?: number;
}

// Shared implementation for any OpenAI-compatible chat provider used as the
// chart agent. Posts the system + user messages, parses the JSON response
// into { graphQuery, jqQuery }, hands them to executeChart, and packages the
// result. All failures are thrown as McpError with `details` populated so the
// HTTP error surfaces the provider's raw response and the agent's output.
export async function runChatAgent({
  provider,
  endpoint,
  apiKey,
  model,
  systemPrompt,
  jsonObject = false,
  temperature = 0.2,
  maxTokens = 2000,
  query,
  queryId,
  apolloServer,
}: ChatAgentArgs): Promise<AgentResult> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        ...(jsonObject ? { response_format: { type: 'json_object' } } : {}),
        temperature,
        max_tokens: maxTokens,
      }),
    });
  } catch (error) {
    throw new McpError(
      `${provider} API request failed: ${(error as Error).message}`,
      502,
      { provider, model, stage: 'network' },
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new McpError(
      `${provider} API ${response.status}: ${body.slice(0, 500)}`,
      502,
      { provider, model, status: response.status, body: body.slice(0, 2000) },
    );
  }

  const data = (await response.json()) as {
    model?: string;
    usage?: unknown;
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data?.choices?.[0]?.message?.content;
  // eslint-disable-next-line no-console
  console.log(`[chart] ${provider} raw response`, {
    model: data?.model,
    usage: data?.usage,
    content: text,
  });

  if (typeof text !== 'string' || text.length === 0) {
    throw new McpError(`${provider} returned no message content`, 502, {
      provider,
      model: data?.model,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new McpError(
      `${provider} output is not valid JSON: ${text.slice(0, 300)}`,
      502,
      { provider, model: data?.model, content: text },
    );
  }

  const obj = parsed as { graphQuery?: unknown; jqQuery?: unknown };
  if (typeof obj.graphQuery !== 'string' || typeof obj.jqQuery !== 'string') {
    throw new McpError(
      `${provider} response missing string graphQuery or jqQuery`,
      502,
      { provider, model: data?.model, parsed },
    );
  }

  // Wrap executeChart errors so the model output is visible alongside the
  // pipeline failure (graphql/jq/highcharts).
  try {
    const { chartId } = await executeChart({
      graphQuery: obj.graphQuery,
      jqQuery: obj.jqQuery,
      queryId,
      apolloServer,
    });
    return {
      provider,
      chartId,
      raw: {
        model: data.model,
        usage: data.usage,
        graphQuery: obj.graphQuery,
        jqQuery: obj.jqQuery,
      },
    };
  } catch (err) {
    const inner = err instanceof McpError ? err : undefined;
    throw new McpError(
      err instanceof Error ? err.message : String(err),
      inner?.status ?? 500,
      {
        provider,
        model: data.model,
        usage: data.usage,
        graphQuery: obj.graphQuery,
        jqQuery: obj.jqQuery,
        pipeline: inner?.details,
      },
    );
  }
}
