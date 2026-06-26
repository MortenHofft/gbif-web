import express from 'express';
import { config } from './lib/config';
import { datasetRouter } from './pages/dataset/routes';

const app = express();

// Static assets: the Tailwind stylesheet and built island bundles.
app.use(
  express.static('public', {
    maxAge: config.isProduction ? '1h' : 0,
    index: false,
  })
);

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

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`gbif-org-ssr listening on http://localhost:${config.port}`);
});
