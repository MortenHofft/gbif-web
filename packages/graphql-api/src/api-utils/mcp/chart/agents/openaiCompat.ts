import rawConfig from '@/config';
import { McpError } from '../errors';
import { ChatMessage, LlmCaller, runWithRetry } from './llmCall';
import { AgentArgs, AgentResult } from './types';

const config = rawConfig as typeof rawConfig & {
  chartAgentMaxAttempts?: number;
};

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
// chart agent. Wraps the provider behind an LlmCaller so runWithRetry can
// drive the call+parse+self-correct loop.
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
  const caller: LlmCaller = {
    provider,
    model,
    async call(messages: ChatMessage[]) {
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
            messages,
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
          {
            provider,
            model,
            status: response.status,
            body: body.slice(0, 2000),
          },
        );
      }

      const data = (await response.json()) as {
        model?: string;
        usage?: unknown;
        choices?: Array<{ message?: { content?: string } }>;
      };
      return {
        text: data?.choices?.[0]?.message?.content ?? '',
        rawModel: data?.model,
        usage: data?.usage,
      };
    },
  };

  return runWithRetry({
    caller,
    systemPrompt,
    userQuery: query,
    queryId,
    apolloServer,
    maxAttempts: config.chartAgentMaxAttempts ?? 2,
  });
}
