import rawConfig from '@/config';
import { runChatAgent } from './openaiCompat';
import { CHART_SYSTEM_PROMPT } from './sharedPrompt';
import { Agent } from './types';

const config = rawConfig as typeof rawConfig & {
  groqApiKey?: string;
  groqModel?: string;
};

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
// Llama 3.3 70B fits the free tier, is fast (~500 tok/s), and follows
// structured-output instructions reliably for this task.
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export const groqAgent: Agent = {
  name: 'groq',
  isAvailable: () =>
    typeof config.groqApiKey === 'string' && config.groqApiKey.length > 0,
  async run(args) {
    return runChatAgent({
      ...args,
      provider: 'groq',
      endpoint: ENDPOINT,
      apiKey: config.groqApiKey ?? '',
      model: config.groqModel ?? DEFAULT_MODEL,
      systemPrompt: CHART_SYSTEM_PROMPT,
      jsonObject: true,
    });
  },
};
