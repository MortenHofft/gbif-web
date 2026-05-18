import rawConfig from '@/config';
import { McpError } from '../errors';
import { ChatMessage, LlmCaller, runWithRetry } from './llmCall';
import { CHART_SYSTEM_PROMPT } from './sharedPrompt';
import { Agent } from './types';

const config = rawConfig as typeof rawConfig & {
  geminiApiKey?: string;
  geminiModel?: string;
  chartAgentMaxAttempts?: number;
};

const PROVIDER = 'gemini';
const DEFAULT_MODEL = 'gemini-flash-latest';

function endpointFor(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`;
}

// Maps the provider-agnostic ChatMessage[] onto Gemini's contents +
// systemInstruction shape. Gemini uses role 'model' for assistant turns and
// stores the system message in a separate top-level field.
function toGeminiBody(messages: ChatMessage[]) {
  const systemInstruction = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  return {
    ...(systemInstruction
      ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
      : {}),
    contents,
    generationConfig: {
      // Forces a single JSON object — equivalent to OpenAI's
      // response_format: { type: 'json_object' }.
      responseMimeType: 'application/json',
      temperature: 0.2,
      maxOutputTokens: 2000,
    },
  };
}

export const geminiAgent: Agent = {
  name: PROVIDER,
  isAvailable: () =>
    typeof config.geminiApiKey === 'string' && config.geminiApiKey.length > 0,
  async run({ query, queryId, apolloServer }) {
    const model = config.geminiModel ?? DEFAULT_MODEL;
    const apiKey = config.geminiApiKey ?? '';
    const url = endpointFor(model);

    const caller: LlmCaller = {
      provider: PROVIDER,
      model,
      async call(messages: ChatMessage[]) {
        let response: Response;
        try {
          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-goog-api-key': apiKey,
            },
            body: JSON.stringify(toGeminiBody(messages)),
          });
        } catch (error) {
          throw new McpError(
            `${PROVIDER} API request failed: ${(error as Error).message}`,
            502,
            { provider: PROVIDER, model, stage: 'network' },
          );
        }

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new McpError(
            `${PROVIDER} API ${response.status}: ${body.slice(0, 500)}`,
            502,
            {
              provider: PROVIDER,
              model,
              status: response.status,
              body: body.slice(0, 2000),
            },
          );
        }

        const data = (await response.json()) as {
          modelVersion?: string;
          usageMetadata?: unknown;
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };
        // Gemini may emit multiple text parts (thought summaries + answer);
        // concatenate them.
        const text =
          data?.candidates?.[0]?.content?.parts
            ?.map((p) => p?.text)
            .filter((t): t is string => typeof t === 'string')
            .join('') ?? '';
        return {
          text,
          rawModel: data?.modelVersion,
          usage: data?.usageMetadata,
        };
      },
    };

    return runWithRetry({
      caller,
      systemPrompt: CHART_SYSTEM_PROMPT,
      userQuery: query,
      queryId,
      apolloServer,
      maxAttempts: config.chartAgentMaxAttempts ?? 2,
    });
  },
};
