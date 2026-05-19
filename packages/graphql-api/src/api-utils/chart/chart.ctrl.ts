/*
 * REST routes that drive the custom-chart card on the occurrence dashboard.
 *
 *   POST /chart/query              — run the configured chart agent (see
 *                                    ./agents) against a natural-language
 *                                    query, store the resulting chart, and
 *                                    return the saved config.
 *   GET  /chart/key/:key           — fetch a saved chart config (or "_list"
 *                                    for keys).
 *   POST /chart/key/:key/refresh   — re-run the stored graphQuery + jqQuery
 *                                    against a new predicate (body:
 *                                    { predicate }). The original predicate
 *                                    on the ChartConfig is not mutated, so
 *                                    the client can still offer
 *                                    "restore original".
 */
import { Application, Response } from 'express';
import { ApolloServer } from 'apollo-server-express';
import { ExpressContext } from 'apollo-server-express/dist/ApolloServer';
import hash from 'object-hash';
import ask from './agent';
import { McpError } from './errors';
import { refreshChart } from './executeChart';
import { createChartConfig, getAllKeys, getChartConfig } from './store';

const QUERY_PATH = '/chart/query';
const KEY_PATH = '/chart/key/:key';
const REFRESH_PATH = '/chart/key/:key/refresh';

// Shared error responder. McpError adds a status code and structured details
// (set by executeChart / agents) that we pass through verbatim so the client
// and the api log see the same shape. Optional `extra` is merged into
// details — used by the query route to attach the original user query
// alongside whatever provider/model/stage info the agent surfaced.
function respondWithError(
  res: Response,
  context: string,
  error: unknown,
  extra?: Record<string, unknown>,
): Response {
  // eslint-disable-next-line no-console
  console.error(`${context}:`, error);
  const status = error instanceof McpError ? error.status : 500;
  const message =
    error instanceof Error ? error.message : 'Internal Server Error';
  const baseDetails = error instanceof McpError ? error.details : undefined;
  const baseObj =
    baseDetails && typeof baseDetails === 'object'
      ? (baseDetails as Record<string, unknown>)
      : {};
  const details = extra ? { ...baseObj, ...extra } : baseDetails;
  return res.status(status).json({ message, details });
}

export default function chartController(
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
      const query =
        typeof req.body?.q === 'string' ? req.body.q : undefined;
      return respondWithError(res, 'Chart query error', error, { query });
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
