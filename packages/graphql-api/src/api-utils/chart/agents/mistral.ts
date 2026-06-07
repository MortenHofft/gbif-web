import rawConfig from '@/config';
import { runChatAgent } from './openaiCompat';
import { CHART_SYSTEM_PROMPT } from './sharedPrompt';
import { Agent } from './types';

const config = rawConfig as typeof rawConfig & {
  mistralApiKey?: string;
  mistralModel?: string;
};

const ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';
const DEFAULT_MODEL = 'mistral-small-latest';

const mistralAgent: Agent = {
  name: 'mistral',
  isAvailable: () =>
    typeof config.mistralApiKey === 'string' && config.mistralApiKey.length > 0,
  async run(args) {
    return runChatAgent({
      ...args,
      provider: 'mistral',
      endpoint: ENDPOINT,
      apiKey: config.mistralApiKey ?? '',
      model: config.mistralModel ?? DEFAULT_MODEL,
      systemPrompt: CHART_SYSTEM_PROMPT,
      jsonObject: true,
    });
  },
};
export default mistralAgent;
