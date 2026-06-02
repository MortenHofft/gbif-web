/* eslint-disable no-console */
/**
 * Dependency-free delaying reverse proxy for reproducing the "slow es-api"
 * cascade locally.
 *
 * It forwards every request to TARGET (your real es-api) but waits DELAY_MS
 * (+ up to JITTER_MS random) before forwarding, simulating a slow upstream.
 * Point the GraphQL API's `apiEs` config at this proxy:
 *
 *   node tools/repro/delay-proxy.js
 *   # then in .env:  apiEs: http://localhost:8088/
 *
 * Env vars:
 *   PORT      proxy listen port            (default 8088)
 *   TARGET    real es-api base url         (default https://hp-search.gbif-test.org)
 *   DELAY_MS  delay before forwarding      (default 5000)
 *   JITTER_MS extra random delay 0..JITTER (default 0)
 *   MAX_INFLIGHT  if set, only this many requests are forwarded at once; the
 *                 rest wait — simulates an upstream/queue that is itself capped
 *                 (e.g. the es-api "toEsQuery" queue backing up).  (default: off)
 */
const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');

const PORT = Number(process.env.PORT || 8088);
const TARGET = process.env.TARGET || 'https://hp-search.gbif-test.org';
const DELAY_MS = Number(process.env.DELAY_MS || 5000);
const JITTER_MS = Number(process.env.JITTER_MS || 0);
const MAX_INFLIGHT = process.env.MAX_INFLIGHT
  ? Number(process.env.MAX_INFLIGHT)
  : Infinity;

const target = new URL(TARGET);
const upstream = target.protocol === 'https:' ? https : http;

let inflight = 0;
const waiters = [];
let totalSeen = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function acquire() {
  if (inflight < MAX_INFLIGHT) {
    inflight += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiters.push(resolve));
}
function release() {
  inflight -= 1;
  const next = waiters.shift();
  if (next) {
    inflight += 1;
    next();
  }
}

const server = http.createServer((clientReq, clientRes) => {
  const id = (totalSeen += 1);
  const chunks = [];
  clientReq.on('data', (c) => chunks.push(c));
  clientReq.on('end', async () => {
    const body = Buffer.concat(chunks);
    await acquire();
    const delay = DELAY_MS + (JITTER_MS ? Math.random() * JITTER_MS : 0);
    if (id % 25 === 1) {
      console.log(
        `[#${id}] ${clientReq.method} ${clientReq.url} -> sleeping ${Math.round(
          delay,
        )}ms (inflight=${inflight}, queued=${waiters.length})`,
      );
    }
    await sleep(delay);

    const options = {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      method: clientReq.method,
      path: clientReq.url,
      headers: { ...clientReq.headers, host: target.host },
    };

    const proxyReq = upstream.request(options, (proxyRes) => {
      clientRes.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(clientRes);
      proxyRes.on('end', release);
    });
    proxyReq.on('error', (err) => {
      release();
      if (!clientRes.headersSent) clientRes.writeHead(502);
      clientRes.end(`proxy error: ${err.message}`);
    });
    if (body.length) proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(PORT, () => {
  console.log(
    `delay-proxy listening on http://localhost:${PORT} -> ${TARGET}\n` +
      `  DELAY_MS=${DELAY_MS} JITTER_MS=${JITTER_MS} MAX_INFLIGHT=${MAX_INFLIGHT}`,
  );
});
