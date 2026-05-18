import rawConfig from '@/config';
import { groqAgent } from './agents/groq';
import { mistralAgent } from './agents/mistral';
import { mockAgent } from './agents/mock';
import { Agent, AgentArgs, AgentResult } from './agents/types';

const config = rawConfig as typeof rawConfig & {
  chartAgent?: string;
};

// Add new agents here when experimenting with additional providers.
const agents: Record<string, Agent> = {
  mock: mockAgent,
  mistral: mistralAgent,
  groq: groqAgent,
};

// Default when nothing is configured. Override per environment by setting
// `chartAgent: <name>` in packages/graphql-api/.env, or change this constant
// in code. If the requested agent isn't available (e.g. no API key), the
// dispatcher logs a warning and falls back to the mock so the server still
// boots.
const DEFAULT_AGENT = 'mock';

function selectAgent(): Agent {
  const requested = config.chartAgent ?? DEFAULT_AGENT;
  const agent = agents[requested];
  if (!agent) {
    const available = Object.keys(agents).join(', ');
    throw new Error(
      `Unknown chartAgent '${requested}'. Available: ${available}`,
    );
  }
  if (!agent.isAvailable()) {
    // eslint-disable-next-line no-console
    console.warn(
      `chartAgent '${requested}' not available (missing config); falling back to 'mock'.`,
    );
    return mockAgent;
  }
  return agent;
}

export default async function ask(args: AgentArgs): Promise<AgentResult> {
  return selectAgent().run(args);
}

export type { AgentArgs, AgentResult } from './agents/types';
