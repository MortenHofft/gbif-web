#!/usr/bin/env node
/**
 * Simple, dependency-free load generator for the gbif.org site (or a hosted
 * portal / staging / local instance).
 *
 * Strategy:
 *   1. Build a pool of taxon keys by paging the GBIF species *search* API at
 *      random offsets (so the keys are varied and not all from one branch).
 *   2. Repeatedly request the site's species page for a random key from the
 *      pool at a steady, configurable rate (default 30 requests/second).
 *   3. Keep going until the process is stopped (Ctrl-C), printing live stats
 *      so you can see what happens: throughput, latency percentiles, status
 *      code distribution and how many requests are still in flight.
 *
 * Nothing is written anywhere and no GBIF write APIs are touched - this only
 * issues GET requests.
 *
 * Usage:
 *   node scripts/loadTest.mjs
 *   TARGET=https://www.gbif.org RATE=30 node scripts/loadTest.mjs
 *   node scripts/loadTest.mjs --target=http://localhost:3000 --rate=10
 *
 * Configuration (CLI flag or env var; CLI wins):
 *   --target / TARGET            Base URL of the site under test.
 *                                Default: https://www.gbif.org
 *   --rate / RATE                Requests per second to send. Default: 30
 *   --path / PATH_TEMPLATE       Page path template, {key} is replaced by a
 *                                taxon key. Default: /species/{key}
 *   --pool-size / POOL_SIZE      Number of taxon keys to gather up front.
 *                                Default: 1000
 *   --species-api / SPECIES_API  GBIF species search API base used to build
 *                                the pool. Default: https://api.gbif.org/v1
 *   --search / SEARCH_PARAMS     Extra query string appended to the species
 *                                search (e.g. "rank=SPECIES&status=ACCEPTED").
 *                                Default: status=ACCEPTED
 *   --timeout / TIMEOUT_MS       Per-request timeout in ms. Default: 30000
 *   --max-inflight / MAX_INFLIGHT  Safety cap on concurrent in-flight
 *                                requests; new requests are skipped (and
 *                                counted) once exceeded. 0 = unlimited.
 *                                Default: 0
 *   --report / REPORT_MS         Stats print interval in ms. Default: 5000
 *   --duration / DURATION_S      Stop automatically after N seconds.
 *                                0 = run until stopped. Default: 0
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function readArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
    else if (arg.startsWith('--')) args[arg.slice(2)] = 'true';
  }
  return args;
}

const cli = readArgs();
const pick = (cliKey, envKey, fallback) => cli[cliKey] ?? process.env[envKey] ?? fallback;

const config = {
  target: String(pick('target', 'TARGET', 'https://www.gbif.org')).replace(/\/$/, ''),
  rate: Number(pick('rate', 'RATE', 30)),
  pathTemplate: String(pick('path', 'PATH_TEMPLATE', '/species/{key}')),
  poolSize: Number(pick('pool-size', 'POOL_SIZE', 1000)),
  speciesApi: String(pick('species-api', 'SPECIES_API', 'https://api.gbif.org/v1')).replace(
    /\/$/,
    ''
  ),
  searchParams: String(pick('search', 'SEARCH_PARAMS', 'status=ACCEPTED')),
  timeoutMs: Number(pick('timeout', 'TIMEOUT_MS', 30000)),
  maxInflight: Number(pick('max-inflight', 'MAX_INFLIGHT', 0)),
  reportMs: Number(pick('report', 'REPORT_MS', 5000)),
  durationS: Number(pick('duration', 'DURATION_S', 0)),
};

if (!Number.isFinite(config.rate) || config.rate <= 0) {
  console.error('RATE must be a positive number.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

const stats = {
  startedAt: Date.now(),
  scheduled: 0, // requests we attempted to start
  sent: 0, // requests actually dispatched
  completed: 0, // got any HTTP response
  ok: 0, // 2xx/3xx
  failed: 0, // network error / timeout
  skippedInflight: 0, // skipped because of maxInflight cap
  inflight: 0,
  maxInflightSeen: 0,
  statusCounts: new Map(), // status code (or error label) -> count
  latencies: [], // ms, completed requests since last reset for percentiles
  latencyAll: { sum: 0, count: 0 }, // running totals across whole run
};

function bump(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

// ---------------------------------------------------------------------------
// Build the taxon key pool
// ---------------------------------------------------------------------------

async function buildPool() {
  const keys = new Set();
  const pageLimit = 100; // species search caps limit at 1000, 100 keeps it light
  // The species search count is large; sample random offsets for variety.
  const maxOffset = 90000; // search API rejects very large offsets, stay well under

  console.log(
    `Building a pool of ~${config.poolSize} taxon keys from ${config.speciesApi}/species/search ...`
  );

  let attempts = 0;
  while (keys.size < config.poolSize && attempts < config.poolSize * 2) {
    attempts++;
    const offset = Math.floor(Math.random() * maxOffset);
    const url =
      `${config.speciesApi}/species/search?limit=${pageLimit}&offset=${offset}` +
      (config.searchParams ? `&${config.searchParams}` : '');
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        console.warn(`  species search returned ${res.status} for offset ${offset}, retrying...`);
        continue;
      }
      const json = await res.json();
      for (const r of json.results ?? []) {
        // Prefer the backbone usage key (nubKey) so the site page resolves,
        // fall back to the record key.
        const key = r.nubKey ?? r.key;
        if (typeof key === 'number') keys.add(key);
      }
    } catch (err) {
      console.warn(`  species search failed for offset ${offset}: ${err.message}`);
    }
  }

  const pool = [...keys];
  if (pool.length === 0) {
    console.error('Could not collect any taxon keys. Check SPECIES_API / SEARCH_PARAMS.');
    process.exit(1);
  }
  console.log(`Pool ready: ${pool.length} unique taxon keys.\n`);
  return pool;
}

// ---------------------------------------------------------------------------
// Request loop
// ---------------------------------------------------------------------------

function makeUrl(pool) {
  const key = pool[Math.floor(Math.random() * pool.length)];
  return config.target + config.pathTemplate.replace('{key}', String(key));
}

function fireRequest(url) {
  stats.scheduled++;

  if (config.maxInflight > 0 && stats.inflight >= config.maxInflight) {
    stats.skippedInflight++;
    return;
  }

  stats.sent++;
  stats.inflight++;
  stats.maxInflightSeen = Math.max(stats.maxInflightSeen, stats.inflight);

  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  fetch(url, {
    redirect: 'follow',
    signal: controller.signal,
    headers: {
      // Identify the traffic so it can be told apart from real users.
      'User-Agent': 'gbif-web-loadtest/1.0',
      Accept: 'text/html',
    },
  })
    .then((res) => {
      stats.completed++;
      bump(stats.statusCounts, res.status);
      if (res.status < 400) stats.ok++;
      // Drain the body so the connection can be reused / freed.
      return res.arrayBuffer().catch(() => undefined);
    })
    .catch((err) => {
      stats.failed++;
      const label = err.name === 'AbortError' ? 'timeout' : `err:${err.code ?? err.name ?? 'unknown'}`;
      bump(stats.statusCounts, label);
    })
    .finally(() => {
      clearTimeout(timer);
      stats.inflight--;
      const ms = Date.now() - startedAt;
      stats.latencies.push(ms);
      stats.latencyAll.sum += ms;
      stats.latencyAll.count++;
    });
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

let lastReport = { at: Date.now(), completed: 0 };

function report(final = false) {
  const now = Date.now();
  const elapsedS = (now - stats.startedAt) / 1000;
  const windowS = (now - lastReport.at) / 1000 || 1;
  const windowCompleted = stats.completed - lastReport.completed;
  const actualRps = windowCompleted / windowS;

  const sorted = stats.latencies.slice().sort((a, b) => a - b);
  const p50 = percentile(sorted, 50);
  const p90 = percentile(sorted, 90);
  const p99 = percentile(sorted, 99);
  const avgAll = stats.latencyAll.count
    ? Math.round(stats.latencyAll.sum / stats.latencyAll.count)
    : 0;

  const statusStr = [...stats.statusCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}=${v}`)
    .join('  ');

  console.log(
    `[${elapsedS.toFixed(0)}s] ` +
      `target≈${config.rate}/s actual≈${actualRps.toFixed(1)}/s | ` +
      `sent=${stats.sent} done=${stats.completed} ok=${stats.ok} fail=${stats.failed}` +
      (stats.skippedInflight ? ` skipped=${stats.skippedInflight}` : '') +
      ` | inflight=${stats.inflight} (max ${stats.maxInflightSeen}) | ` +
      `latency ms p50=${p50} p90=${p90} p99=${p99} avg=${avgAll}` +
      `\n      status: ${statusStr || '(none yet)'}`
  );

  lastReport = { at: now, completed: stats.completed };
  // Reset the per-window latency sample so percentiles reflect recent traffic.
  stats.latencies.length = 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('GBIF site load generator');
  console.log('------------------------');
  console.log(`  target:   ${config.target}`);
  console.log(`  path:     ${config.pathTemplate}`);
  console.log(`  rate:     ${config.rate} requests/second`);
  console.log(`  pool:     ${config.poolSize} taxon keys (search: ${config.searchParams || 'none'})`);
  console.log(`  timeout:  ${config.timeoutMs} ms`);
  console.log(
    `  inflight: ${config.maxInflight > 0 ? `capped at ${config.maxInflight}` : 'unlimited'}`
  );
  console.log(`  duration: ${config.durationS > 0 ? `${config.durationS}s` : 'until stopped'}`);
  console.log('');

  const pool = await buildPool();

  // Steady-rate scheduler: one request every (1000 / rate) ms.
  const intervalMs = 1000 / config.rate;
  let tickAccumulator = 0;
  let lastTick = Date.now();

  const sendTimer = setInterval(() => {
    // Compensate for timer drift / coarse timer resolution: figure out how
    // many requests we should have sent since the last tick and send them.
    const now = Date.now();
    tickAccumulator += ((now - lastTick) / 1000) * config.rate;
    lastTick = now;
    while (tickAccumulator >= 1) {
      tickAccumulator -= 1;
      fireRequest(makeUrl(pool));
    }
  }, Math.max(1, Math.min(intervalMs, 50)));

  const reportTimer = setInterval(() => report(false), config.reportMs);

  let stopping = false;
  const shutdown = (reason) => {
    if (stopping) return;
    stopping = true;
    clearInterval(sendTimer);
    clearInterval(reportTimer);
    console.log(`\nStopping (${reason}). Waiting up to 5s for in-flight requests...`);
    const deadline = Date.now() + 5000;
    const wait = setInterval(() => {
      if (stats.inflight === 0 || Date.now() > deadline) {
        clearInterval(wait);
        console.log('\n=== Final summary ===');
        report(true);
        const elapsedS = (Date.now() - stats.startedAt) / 1000;
        console.log(
          `Total over ${elapsedS.toFixed(0)}s: sent=${stats.sent} done=${stats.completed} ` +
            `ok=${stats.ok} fail=${stats.failed} skipped=${stats.skippedInflight}`
        );
        process.exit(0);
      }
    }, 100);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  if (config.durationS > 0) {
    setTimeout(() => shutdown(`duration ${config.durationS}s reached`), config.durationS * 1000);
  }

  console.log('Sending traffic. Press Ctrl-C to stop.\n');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
