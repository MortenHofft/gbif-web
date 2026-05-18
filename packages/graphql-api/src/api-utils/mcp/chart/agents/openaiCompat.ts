import { McpError } from '../errors';
import { runChartFromAgentJson } from './runChartFromJson';
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
// chart agent. Posts the system + user messages, then hands the model's text
// off to runChartFromAgentJson for the parse + executeChart step.
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
  const text = data?.choices?.[0]?.message?.content ?? '';

  return runChartFromAgentJson({
    provider,
    model: data?.model,
    usage: data?.usage,
    text,
    queryId,
    apolloServer,
  });
}
