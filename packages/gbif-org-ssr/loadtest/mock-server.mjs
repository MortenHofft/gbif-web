// Mock GraphQL upstream for load-testing the SSR server in isolation.
//
// Returns canned fixtures for any query, so the SSR server's per-request cost (fetch +
// JSON.parse + transform + Preact render + response write) is measured WITHOUT real backend
// latency or variance. Because every dataset key returns the same body, hitting /dataset/<random>
// still forces a fresh render every request (nothing is cacheable by key).
//
// Zero dependencies. Listens on PORT (default 4010). Point the SSR server at it with
// PUBLIC_GRAPHQL_ENDPOINT=http://localhost:4010/graphql.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '4010', 10);

const datasetBody = readFileSync(join(__dirname, 'fixtures/dataset.json'));
const facetBody = readFileSync(join(__dirname, 'fixtures/facet.json'));

const server = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    // Pick the fixture by query shape. Cheap substring check — good enough for the mock.
    const isFacet = body.includes('occurrenceSearch');
    const payload = isFacet ? facetBody : datasetBody;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(payload);
  });
});

server.listen(PORT, () => console.log(`mock GraphQL upstream on http://localhost:${PORT}/graphql`));
