import rawConfig from '@/config';
import { McpError } from '../errors';
import {
  ChatMessage,
  LlmCaller,
  runWithRetry,
  wrapFetchError,
} from './llmCall';
import { CHART_SYSTEM_PROMPT } from './sharedPrompt';
import { Agent } from './types';

const config = rawConfig as typeof rawConfig & {
  geminiApiKey?: string;
  geminiModel?: string;
  // Output cap for the Gemini response. Defaults generous because Gemini's
  // silent reasoning is included in this budget on thinking-capable models —
  // a 2000-token cap got eaten before the visible response could complete.
  geminiMaxOutputTokens?: number;
  // 0 disables Gemini's silent reasoning (default — our task is structured
  // enough that reasoning rarely improves output and just burns budget). Set
  // to -1 for dynamic, or a positive integer to allow up to N thinking
  // tokens. Only relevant for thinking-capable models (Gemini 2.5+, Gemini 3+).
  geminiThinkingBudget?: number;
};

const PROVIDER = 'gemini';
const DEFAULT_MODEL = 'gemini-flash-latest';
const DEFAULT_MAX_OUTPUT_TOKENS = 8000;
const DEFAULT_THINKING_BUDGET = 0;

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
  const thinkingBudget =
    config.geminiThinkingBudget ?? DEFAULT_THINKING_BUDGET;
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
      maxOutputTokens:
        config.geminiMaxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      thinkingConfig: { thinkingBudget },
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
          throw wrapFetchError(PROVIDER, model, error);
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
          usageMetadata?: {
            thoughtsTokenCount?: number;
            candidatesTokenCount?: number;
            promptTokenCount?: number;
            totalTokenCount?: number;
          };
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
            finishReason?: string;
          }>;
        };

        const candidate = data?.candidates?.[0];
        // Gemini may emit multiple text parts (thought summaries + answer);
        // concatenate them.
        const text =
          candidate?.content?.parts
            ?.map((p) => p?.text)
            .filter((t): t is string => typeof t === 'string')
            .join('') ?? '';

        // Truncation is the silent killer for thinking-capable models: the
        // thinking tokens count against maxOutputTokens and the visible
        // response gets cut mid-string. Detect it and throw a useful error
        // instead of letting JSON.parse downstream fail with no context.
        if (candidate?.finishReason === 'MAX_TOKENS') {
          const thoughts = data.usageMetadata?.thoughtsTokenCount;
          const visible = data.usageMetadata?.candidatesTokenCount;
          throw new McpError(
            `${PROVIDER} hit MAX_TOKENS before completing the response (thoughts: ${thoughts ?? '?'}, visible: ${visible ?? '?'}). Increase geminiMaxOutputTokens in .env, or lower geminiThinkingBudget.`,
            502,
            {
              provider: PROVIDER,
              model,
              finishReason: candidate.finishReason,
              usage: data.usageMetadata,
              content: text,
            },
          );
        }

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
    });
  },
};
