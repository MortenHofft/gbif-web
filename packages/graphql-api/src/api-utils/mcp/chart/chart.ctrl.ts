/*
 * Chart MCP endpoint, exposed as a remote MCP server over the Streamable HTTP
 * transport at /mcp/chart. Two tools: gbif_usage_guidelines + create_visualization.
 *
 * Companion REST routes:
 *   POST /mcp/chart/query              — server-driven flow: run the chart
 *                                        agent (currently a deterministic stub
 *                                        that always produces a basisOfRecord
 *                                        pie chart) and return the saved
 *                                        chart configs.
 *   GET  /mcp/chart/key/:key           — fetch a saved chart config (or
 *                                        "_list" for keys).
 *   POST /mcp/chart/key/:key/refresh   — re-run the stored graphQuery +
 *                                        jqQuery against a new predicate
 *                                        (passed in the body). The original
 *                                        predicate on the ChartConfig is not
 *                                        mutated, so the client can still
 *                                        offer "restore original".
 *
 * Auth: when config.mcpApiToken is set, the MCP endpoint requires
 * Authorization: Bearer <token>. The conversation/chart-store id flows through
 * as the queryId tool argument (no Authorization-header smuggling).
 *
 * Security: same Origin/Host DNS-rebinding guard as helloWorld.
 */
import { randomUUID } from 'node:crypto';
import { Application, NextFunction, Request, Response } from 'express';
import { ApolloServer } from 'apollo-server-express';
import { ExpressContext } from 'apollo-server-express/dist/ApolloServer';
import hash from 'object-hash';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import rawConfig from '@/config';
import ask from './agent';
import { McpError } from './errors';
import { refreshChart } from './executeChart';
import { registerChartTools } from './tools';
import {
  createChartConfig,
  getAllKeys,
  getChartConfig,
} from './store';

const config = rawConfig as typeof rawConfig & {
  mcpApiToken?: string;
};

const MCP_PATH = '/mcp/chart';
const QUERY_PATH = '/mcp/chart/query';
const KEY_PATH = '/mcp/chart/key/:key';
const REFRESH_PATH = '/mcp/chart/key/:key/refresh';

function buildServer(apolloServer: ApolloServer<ExpressContext>): McpServer {
  const server = new McpServer({
    name: 'gbif-chart',
    version: '1.0.0',
  });
  registerChartTools(server, apolloServer);
  return server;
}

function getAllowedOrigins(): string[] | undefined {
  const fromEnv = process.env.MCP_ALLOWED_ORIGINS;
  if (fromEnv) {
    return fromEnv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (config.origin) return [config.origin];
  return undefined;
}

function getAllowedHosts(): string[] | undefined {
  const fromEnv = process.env.MCP_ALLOWED_HOSTS;
  if (fromEnv) {
    return fromEnv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

function dnsRebindingGuard(
  allowedOrigins: string[] | undefined,
  allowedHosts: string[] | undefined,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (allowedOrigins && allowedOrigins.length > 0) {
      const origin = req.get('origin');
      if (origin && !allowedOrigins.includes(origin)) {
        return res
          .status(403)
          .json({ error: 'Forbidden: origin not allowed' });
      }
    }
    if (allowedHosts && allowedHosts.length > 0) {
      const host = req.get('host');
      if (!host || !allowedHosts.includes(host)) {
        return res.status(403).json({ error: 'Forbidden: host not allowed' });
      }
    }
    return next();
  };
}

function bearerToken(req: Request): string | undefined {
  const header = req.get('authorization');
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return undefined;
  return token;
}

function requireMcpToken(req: Request, res: Response, next: NextFunction) {
  if (!config.mcpApiToken) return next();
  if (bearerToken(req) === config.mcpApiToken) return next();
  return res.status(401).json({ message: 'Unauthorized' });
}

export default function mcpChartController(
  app: Application,
  apolloServer: ApolloServer<ExpressContext>,
) {
  const allowedOrigins = getAllowedOrigins();
  const allowedHosts = getAllowedHosts();
  const guard = dnsRebindingGuard(allowedOrigins, allowedHosts);

  // Stateless mode: each MCP HTTP request gets its own transport+server pair.
  // Per-conversation state lives in the chart store keyed by queryId, which
  // the LLM receives via the system prompt and passes back as a tool arg.
  const handleMcp = async (req: Request, res: Response) => {
    try {
      const server = buildServer(apolloServer);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      res.on('close', () => {
        transport.close();
        server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('MCP chart error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  };

  app.post(MCP_PATH, guard, requireMcpToken, handleMcp);

  app.get(MCP_PATH, guard, requireMcpToken, (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed (stateless server, no GET stream).',
      },
      id: null,
    });
  });

  app.delete(MCP_PATH, guard, requireMcpToken, (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed (stateless server, no session to close).',
      },
      id: randomUUID(),
    });
  });

  // Server-driven flow: a website dashboard posts a natural-language query and
  // the current GBIF predicate; we hand it to Claude, which calls our own MCP
  // server to build chart configs, and we return whatever charts were stored.
  app.post(QUERY_PATH, async (req, res) => {
    try {
      const { predicate, q: query } = req.body ?? {};
      if (typeof query !== 'string' || query.length === 0) {
        return res
          .status(400)
          .json({ message: 'Missing required body field "q" (query string).' });
      }
      const queryId = hash({ query, predicate }).replace(/\s+/g, '_');
      createChartConfig(queryId, { predicate, query, charts: [] });
      const llm = await ask({ query, queryId, apolloServer });
      const charts = getChartConfig(queryId);
      return res.json({ queryId, charts, llm });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Chart query error:', error);
      const status = error instanceof McpError ? error.status : 500;
      const message =
        error instanceof Error ? error.message : 'Internal Server Error';
      const details = error instanceof McpError ? error.details : undefined;
      return res.status(status).json({ message, details });
    }
  });

  // Frontend re-runs a saved chart against a new predicate (e.g. the current
  // dashboard filters, or the original predicate to "restore"). Only the
  // rendered chart entry is replaced — the ChartConfig's original predicate
  // is untouched so subsequent restores still work.
  app.post(REFRESH_PATH, async (req, res) => {
    try {
      const { key } = req.params;
      const { predicate } = req.body ?? {};
      const updated = await refreshChart({
        queryId: key,
        predicate,
        apolloServer,
      });
      return res.json(updated);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Chart refresh error:', error);
      const status = error instanceof McpError ? error.status : 500;
      const message =
        error instanceof Error ? error.message : 'Internal Server Error';
      const details = error instanceof McpError ? error.details : undefined;
      return res.status(status).json({ message, details });
    }
  });

  // Frontend retrieves a saved chart config by id. "_list" returns all keys.
  app.get(KEY_PATH, (req, res) => {
    try {
      const { key } = req.params;
      if (key === '_list') {
        return res.json({ keys: getAllKeys() });
      }
      const chartConfig = getChartConfig(key);
      if (!chartConfig) {
        return res.status(404).json({ message: 'Chart config not found' });
      }
      return res.json(chartConfig);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching chart config:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });
}
