import rawConfig from '@/config';
import { McpError } from '../errors';
import { runChartFromAgentJson } from './runChartFromJson';
import { CHART_SYSTEM_PROMPT } from './sharedPrompt';
import { Agent } from './types';

const config = rawConfig as typeof rawConfig & {
  geminiApiKey?: string;
  geminiModel?: string;
};

const PROVIDER = 'gemini';
const DEFAULT_MODEL = 'gemini-flash-latest';

function endpointFor(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent`;
}

export const geminiAgent: Agent = {
  name: PROVIDER,
  isAvailable: () =>
    typeof config.geminiApiKey === 'string' && config.geminiApiKey.length > 0,
  async run({ query, queryId, apolloServer }) {
    const model = config.geminiModel ?? DEFAULT_MODEL;
    const apiKey = config.geminiApiKey ?? '';
    const url = endpointFor(model);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: CHART_SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: query }],
            },
          ],
          generationConfig: {
            // Forces the model to emit a single JSON object — equivalent to
            // OpenAI's response_format: { type: 'json_object' }.
            responseMimeType: 'application/json',
            temperature: 0.2,
            maxOutputTokens: 2000,
          },
        }),
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

    // Gemini may emit multiple parts (e.g. thought summaries + answer).
    // Concatenate just the text parts.
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p?.text)
        .filter((t): t is string => typeof t === 'string')
        .join('') ?? '';

    return runChartFromAgentJson({
      provider: PROVIDER,
      model: data?.modelVersion ?? model,
      usage: data?.usageMetadata,
      text,
      queryId,
      apolloServer,
    });
  },
};
