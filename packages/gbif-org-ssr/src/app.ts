import path from 'node:path';
import express from 'express';
import { config } from './lib/config';
import { datasetRouter } from './pages/dataset/routes';

// Builds the Express app WITHOUT listening, so it can be used both as a long-running
// server (src/server.ts) and as a serverless handler (api/index.js on Vercel).
export function createApp() {
  const app = express();

  // Static assets: Tailwind stylesheet + built island bundles. On Vercel these are
  // also served directly from the CDN; this keeps local dev and Node hosts working.
  // Only consult the filesystem for asset-looking paths (those with a file extension),
  // so dynamic routes like /dataset/:key don't pay an ENOENT stat() per request.
  const staticMw = express.static(path.join(process.cwd(), 'public'), {
    maxAge: config.isProduction ? '1h' : 0,
    index: false,
  });
  app.use((req, res, next) => {
    if (req.method === 'GET' && /\.[a-z0-9]+$/i.test(req.path)) return staticMw(req, res, next);
    next();
  });

  // Same-origin GraphQL proxy for client islands. The browser never talks to GBIF
  // directly — no CORS to manage, and a natural place to add caching/auth later.
  app.post('/api/graphql', express.json({ limit: '512kb' }), async (req, res) => {
    try {
      const upstream = await fetch(config.graphqlEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', locale: config.defaultLocale },
        body: JSON.stringify(req.body ?? {}),
        signal: AbortSignal.timeout(15_000),
      });
      res.status(upstream.status);
      res.set('Cache-Control', 'public, max-age=60');
      res.type('application/json').send(await upstream.text());
    } catch {
      res.status(502).json({ errors: [{ message: 'Upstream GraphQL request failed' }] });
    }
  });

  app.use('/dataset', datasetRouter);

  // Convenience: land on a known dataset (iNaturalist) for quick manual testing.
  app.get('/', (_req, res) => res.redirect('/dataset/50c9509d-22c7-4a22-a47d-8c48425ef4a7'));

  return app;
}

const app = createApp();
export default app;
