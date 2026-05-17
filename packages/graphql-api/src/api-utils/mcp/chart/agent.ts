import Anthropic from '@anthropic-ai/sdk';
import rawConfig from '@/config';

// config is loaded from .env YAML at runtime; the JS module's inferred type
// only covers the few keys declared in config.js, so we widen here for the
// MCP-specific settings we read from .env.
const config = rawConfig as typeof rawConfig & {
  claudeApiKey?: string;
  claudeModel?: string;
  mcpApiToken?: string;
  mcpChartEndpoint?: string;
};

const systemPromptTemplate = (queryId: string) =>
  `This query is performed in context of a website dashboard for exploring GBIF mediated biodiversity data.
The user has already applied filters and is now exploring the data.
When the create_visualization tool is called the user will see the resulting chart.
The user will only see the chart and not anything else you write. You are welcome to think out loud if that helps you, but keep it short as it will not be seen by anyone.

You are working in conversation/chart-store id: "${queryId}". You MUST pass this exact value as the queryId argument on every call to create_visualization.`;

interface AskArgs {
  query: string;
  queryId: string;
}

export default async function ask({
  query,
  queryId,
}: AskArgs): Promise<unknown> {
  if (typeof query !== 'string' || query.length === 0) {
    throw new Error('Query must be a non-empty string');
  }
  if (!config.claudeApiKey) {
    throw new Error(
      'Missing claudeApiKey in config; cannot run the chart agent.',
    );
  }

  const anthropic = new Anthropic({ apiKey: config.claudeApiKey });

  const mcpUrl =
    config.mcpChartEndpoint ?? `${config.origin ?? ''}/mcp/chart`;

  // mcp_servers + betas are beta-only fields on the Anthropic SDK and aren't
  // in its public TS types yet, so we cast through unknown.
  const message = await anthropic.beta.messages.create({
    model: config.claudeModel ?? 'claude-sonnet-4-5',
    max_tokens: 1000,
    system: systemPromptTemplate(queryId),
    messages: [{ role: 'user', content: query }],
    mcp_servers: [
      {
        type: 'url',
        url: mcpUrl,
        name: 'gbif-mcp',
        ...(config.mcpApiToken
          ? { authorization_token: config.mcpApiToken }
          : {}),
      },
    ],
    betas: ['mcp-client-2025-04-04'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  return message.content;
}
