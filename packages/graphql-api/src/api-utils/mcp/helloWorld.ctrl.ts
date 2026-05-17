/*
 * Hello-world MCP endpoint, exposed as a remote MCP server over the
 * Streamable HTTP transport at /mcp/hello-world.
 *
 * Security note: the MCP spec warns that any HTTP MCP endpoint must
 * validate the Origin header (to prevent cross-origin requests from
 * malicious web pages) and the Host header (to defend against DNS
 * rebinding attacks that point a hostile origin at this server's
 * own host/port). Stateless mode is used because a single hello-world
 * tool has no per-session state worth keeping.
 */
import { randomUUID } from 'node:crypto';
import { Application, NextFunction, Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import config from '@/config';

const MCP_PATH = '/mcp/hello-world';

function buildServer(): McpServer {
  const server = new McpServer({
    name: 'gbif-hello-world',
    version: '1.0.0',
  });

  // The SDK's generic tool overloads infer the callback's arg type from
  // the zod shape; under strict mode that conditional gets deep enough
  // to trip TS2589, so we cast the shape to bypass inference here and
  // narrow the args ourselves inside the handler.
  const inputSchema = {
    name: z
      .string()
      .min(1)
      .max(100)
      .optional()
      .describe('Optional name to greet'),
  };

  server.registerTool(
    'hello',
    {
      description:
        'Returns a friendly greeting. Provide a name to be greeted by name.',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: inputSchema as any,
    },
    async (args: unknown) => {
      const name = (args as { name?: string }).name;
      return {
        content: [
          {
            type: 'text' as const,
            text: `Hello, ${name ?? 'world'}! 👋 — from the GBIF GraphQL API`,
          },
        ],
      };
    },
  );

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
      // Browsers always send Origin on cross-origin POST. A missing Origin
      // means the request did not come from a browser context, which we
      // allow (e.g. server-to-server MCP clients).
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

export default function mcpHelloWorldController(app: Application) {
  const allowedOrigins = getAllowedOrigins();
  const allowedHosts = getAllowedHosts();
  const guard = dnsRebindingGuard(allowedOrigins, allowedHosts);

  // Stateless mode: each request gets its own transport+server pair, so we
  // don't keep sessions in memory and there is no cross-request state to
  // attack. This matches the SDK's documented stateless pattern.
  const handle = async (req: Request, res: Response) => {
    try {
      const server = buildServer();
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
      console.error('MCP hello-world error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  };

  app.post(MCP_PATH, guard, handle);

  // GET and DELETE are part of the Streamable HTTP spec. In stateless mode
  // they aren't used for sessions, but we still route them through the
  // transport so the server replies with the spec-correct error.
  app.get(MCP_PATH, guard, (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed (stateless server, no GET stream).',
      },
      id: null,
    });
  });

  app.delete(MCP_PATH, guard, (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed (stateless server, no session to close).',
      },
      id: randomUUID(),
    });
  });
}
