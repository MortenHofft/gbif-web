/*
 * REST routes that drive the custom-chart card on the occurrence dashboard.
 *
 *   POST /mcp/chart/query              — run the configured chart agent (see
 *                                        ./agents) against a natural-language
 *                                        query, store the resulting chart,
 *                                        and return the saved config.
 *   GET  /mcp/chart/key/:key           — fetch a saved chart config (or
 *                                        "_list" for keys).
 *   POST /mcp/chart/key/:key/refresh   — re-run the stored graphQuery +
 *                                        jqQuery against a new predicate
 *                                        (body: { predicate }). The original
 *                                        predicate on the ChartConfig is not
 *                                        mutated, so the client can still
 *                                        offer "restore original".
 *
 * The earlier MCP server surface (gbif_usage_guidelines / create_visualization
 * tools over Streamable HTTP) has been removed — the direct-call agents in
 * ./agents bypass it. The /mcp/ URL prefix is retained for compatibility with
 * the existing frontend; consider renaming to /chart/ in a future cleanup.
 */
import { Application, Response } from 'express';
import { ApolloServer } from 'apollo-server-express';
import { ExpressContext } from 'apollo-server-express/dist/ApolloServer';
import hash from 'object-hash';
import ask from './agent';
import { McpError } from './errors';
import { refreshChart } from './executeChart';
import { createChartConfig, getAllKeys, getChartConfig } from './store';

const QUERY_PATH = '/mcp/chart/query';
const KEY_PATH = '/mcp/chart/key/:key';
const REFRESH_PATH = '/mcp/chart/key/:key/refresh';

// Shared error responder. McpError adds a status code and structured details
// (set by executeChart / agents) that we pass through verbatim so the client
// and the api log see the same shape.
function respondWithError(
  res: Response,
  context: string,
  error: unknown,
): Response {
  // eslint-disable-next-line no-console
  console.error(`${context}:`, error);
  const status = error instanceof McpError ? error.status : 500;
  const message =
    error instanceof Error ? error.message : 'Internal Server Error';
  const details = error instanceof McpError ? error.details : undefined;
  return res.status(status).json({ message, details });
}

export default function mcpChartController(
  app: Application,
  apolloServer: ApolloServer<ExpressContext>,
) {
  // Dashboard posts a natural-language query plus the current GBIF predicate.
  // Run the configured chart agent (see ./agents), persist the result keyed
  // by hash({query, predicate}), return the saved config.
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
      return respondWithError(res, 'Chart query error', error);
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
      const { entry, timings } = await refreshChart({
        queryId: key,
        predicate,
        apolloServer,
      });
      return res.json({ ...entry, timings });
    } catch (error) {
      return respondWithError(res, 'Chart refresh error', error);
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
      return respondWithError(res, 'Error fetching chart config', error);
    }
  });
}
