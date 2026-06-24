#!/usr/bin/env node
/**
 * Static mock of the services the gbif-org SSR server talks to, so the site can
 * be built, started and load-tested in isolation (no real GBIF backend).
 *
 * It is intentionally dumb: it ignores the requested key/variables and returns
 * the same static payload for every request. That is exactly what we want for a
 * load test - we are measuring the SSR server's throughput, not data accuracy.
 *
 * What it answers (everything else -> 200 `{}`):
 *   - GraphQL endpoint (POST /graphql and friends):
 *       Switches on the GraphQL operation name and returns a matching static
 *       payload. The real `TaxonKey` payload (a `Panthera leo` response pulled
 *       live from graphql.gbif.org) lives in ./loadtest/taxonExample.json.
 *   - GraphQL endpoint (GET):
 *       The app's GraphQLService first tries a cached GET keyed by a query hash
 *       and only POSTs the full query when the server reports the hash is
 *       unknown. We always answer GET with `{ unknownQueryId: true }` so the
 *       app falls back to a POST that carries the operation name.
 *   - /translations/translations.json + message files:
 *       Minimal i18n entry so the app does not spam the bundled-fallback path.
 *   - /unstable-api/cached-response/* (header/menu):
 *       `{}` so the layout renders with empty (but valid) header data.
 *
 * Usage:
 *   node scripts/mockApi.mjs                 # listens on :4000
 *   PORT=4000 node scripts/mockApi.mjs
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PORT = parseInt(process.env.PORT || process.env.MOCK_PORT || '4000', 10);
const here = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Static GraphQL payloads, keyed by operation name.
// ---------------------------------------------------------------------------

const taxonExample = JSON.parse(
  await readFile(join(here, 'loadtest', 'taxonExample.json'), 'utf8')
);

// Returns the `data` object for a given GraphQL operation. Unknown operations
// get an empty object, which is enough for loaders that only read optional
// fields (and the app degrades gracefully on missing data).
function dataForOperation(operationName) {
  switch (operationName) {
    case 'TaxonKey':
      // The taxon detail page (SSR). Drives /taxon/:key.
      return taxonExample;
    case 'SlowTaxon':
      // Client-side follow-up query on the taxon page.
      return { taxonInfo: { wikiData: null } };
    case 'DeprecatedTaxon':
      // The legacy /species/:key page. Render the "unknown/deleted" view
      // without redirecting: no related new taxon, speciesKey on the backbone.
      return {
        taxon: null,
        speciesKey: {
          taxonID: '1',
          datasetKey: process.env.PUBLIC_CLASSIC_BACKBONE_KEY || 'backbone',
        },
      };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function send(res, status, body, contentType = 'application/json') {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', () => resolve(''));
  });
}

function operationNameFromBody(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed.operationName) return parsed.operationName;
    // Fall back to parsing the query string itself.
    const m = /\bquery\s+(\w+)/.exec(parsed.query || '');
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

let requestCount = 0;

const server = createServer(async (req, res) => {
  requestCount++;
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // GraphQL endpoint(s). Accept any path that contains "graphql".
  if (path.includes('graphql')) {
    if (req.method === 'GET') {
      // Force the app to fall back to a POST carrying the operation name.
      return send(res, 200, { unknownQueryId: true, unknownVariablesId: true });
    }
    if (req.method === 'POST') {
      const raw = await readBody(req);
      const operationName = operationNameFromBody(raw);
      return send(res, 200, { data: dataForOperation(operationName) });
    }
    return send(res, 200, { data: {} });
  }

  // i18n: translation entry + message files.
  if (path.endsWith('/translations.json')) {
    // Point every locale at the same (empty) message file; the app renders
    // react-intl defaultMessages when a key is missing.
    return send(res, 200, { en: { messages: '/messages.json' } });
  }
  if (path.includes('/translations') && path.endsWith('.json')) {
    return send(res, 200, {});
  }

  // Header / menu and any other cached-response lookups -> empty but valid.
  if (path.includes('/cached-response')) {
    return send(res, 200, {});
  }

  // Species search - lets the load script build its key pool offline (point it
  // at this mock with --species-api=http://localhost:PORT/v1). The keys are
  // ignored by the GraphQL mock anyway, so any numbers will do.
  if (path.endsWith('/species/search')) {
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 100);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10) || 0;
    const results = Array.from({ length: limit }, (_, i) => {
      const key = offset + i + 1;
      return { key, nubKey: key };
    });
    return send(res, 200, { offset, limit, endOfRecords: false, count: 1000000, results });
  }

  // Anything else: a harmless empty JSON 200 so nothing hangs.
  return send(res, 200, {});
});

server.listen(PORT, () => {
  console.log(`mock api listening on http://localhost:${PORT}`);
  console.log(`  graphql:       POST http://localhost:${PORT}/graphql`);
  console.log(`  translations:  http://localhost:${PORT}/translations/translations.json`);
  console.log(`  taxon example: Panthera leo (${taxonExample.taxonInfo?.taxonID})`);
});

// Light heartbeat so you can see it is alive during a load test.
setInterval(() => {
  if (requestCount > 0) {
    console.log(`[mock] served ${requestCount} requests so far`);
  }
}, 10000).unref();
