import { ApolloServer } from 'apollo-server-express';
import { ExpressContext } from 'apollo-server-express/dist/ApolloServer';

export interface AgentArgs {
  query: string;
  queryId: string;
  apolloServer: ApolloServer<ExpressContext>;
}

export interface AgentResult {
  provider: string;
  chartId: string;
  // Free-form per-agent debug data (model id, token usage, raw output, etc.).
  // Sent back to the caller of POST /mcp/chart/query so we can compare agents
  // side-by-side while experimenting.
  raw?: unknown;
}

export interface Agent {
  name: string;
  // Returns true when the agent has everything it needs to run (e.g. API key
  // configured). The dispatcher falls back to the mock when this is false.
  isAvailable(): boolean;
  run(args: AgentArgs): Promise<AgentResult>;
}
