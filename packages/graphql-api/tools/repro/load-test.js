/* eslint-disable no-console */
/**
 * Cascade reproduction / verification load test.
 *
 * Hammers the GraphQL API with concurrent *occurrence* searches (which hit
 * es-api, made slow by delay-proxy.js) while, on a separate cadence, issuing
 * *dataset* searches (which hit the v1 API and should stay fast). It reports the
 * dataset-search latency over time — the canary that should NOT degrade if the
 * es-api bulkhead is doing its job — plus the breakdown of occurrence outcomes
 * (ok / timed-out / shed) and live pool depth from /health.
 *
 *   Baseline (bug):  requestPools.occurrence.concurrency: unbounded
 *   Fixed:           requestPools.occurrence.concurrency: <small>, maxQueueDepth: <small>
 *
 * Env vars:
 *   ENDPOINT      graphql endpoint     (default http://localhost:4123/graphql)
 *   HEALTH        health endpoint      (default <ENDPOINT origin>/health)
 *   OCC_CONC      concurrent occurrence searches kept in flight (default 50)
 *   DURATION_MS   how long to run      (default 30000)
 *   PROBE_MS      dataset probe period (default 1000)
 */
const ENDPOINT = process.env.ENDPOINT || 'http://localhost:4123/graphql';
const HEALTH =
  process.env.HEALTH || new URL('/health', ENDPOINT).toString();
const OCC_CONC = Number(process.env.OCC_CONC || 50);
const DURATION_MS = Number(process.env.DURATION_MS || 30000);
const PROBE_MS = Number(process.env.PROBE_MS || 1000);

// Adjust these selections if the schema changes.
const OCC_QUERY = `query Occ { occurrenceSearch(predicate: { type: equals, key: "country", value: "DK" }) { documents { total } } }`;
const DS_QUERY = `query Ds { datasetSearch(q: "") { count } }`;

let stop = false;
const occ = { ok: 0, timeout: 0, shed: 0, otherError: 0, transport: 0 };
const dsLatencies = [];

// Returns { ms, status, errors } where errors is the GraphQL errors array (or null).
async function gql(query) {
  const t0 = performance.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  let errors = null;
  try {
    const json = await res.json();
    errors = json.errors ?? null;
  } catch {
    /* non-JSON body */
  }
  return { ms: performance.now() - t0, status: res.status, errors };
}

function classifyOccError(errors) {
  const code = errors?.[0]?.extensions?.code;
  const status = errors?.[0]?.extensions?.http?.status;
  const msg = errors?.[0]?.message ?? '';
  if (code === 'SERVICE_UNAVAILABLE' || status === 503) return 'shed';
  if (/abort|timeout|timed out/i.test(msg)) return 'timeout';
  return 'otherError';
}

async function occWorker() {
  while (!stop) {
    try {
      const { errors } = await gql(OCC_QUERY);
      if (!errors) occ.ok += 1;
      else occ[classifyOccError(errors)] += 1;
    } catch {
      occ.transport += 1; // socket/connection level failure (often client-side)
    }
  }
}

async function datasetProbe() {
  while (!stop) {
    const start = performance.now();
    try {
      const { ms, status, errors } = await gql(DS_QUERY);
      dsLatencies.push(ms);
      console.log(
        `dataset probe: ${ms.toFixed(0)}ms (status ${status}${
          errors ? ', ERRORS' : ''
        })  [occ ok=${occ.ok} timeout=${occ.timeout} shed=${occ.shed} err=${
          occ.otherError
        } transport=${occ.transport}]`,
      );
    } catch (e) {
      console.log(`dataset probe FAILED: ${e.message}`);
    }
    const elapsed = performance.now() - start;
    await new Promise((r) => setTimeout(r, Math.max(0, PROBE_MS - elapsed)));
  }
}

async function poolMonitor() {
  while (!stop) {
    try {
      const res = await fetch(HEALTH);
      const json = await res.json();
      const p = json.requestPools?.occurrence;
      if (p) {
        console.log(
          `  pool[occurrence] waiting=${p.waiting} running=${p.running} ` +
            `concurrency=${p.concurrency} maxQueueDepth=${p.maxQueueDepth}`,
        );
      }
    } catch {
      /* health may be briefly unavailable under load */
    }
    await new Promise((r) => setTimeout(r, PROBE_MS));
  }
}

function pct(arr, p) {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

(async () => {
  console.log(
    `load-test: ${OCC_CONC} concurrent occurrence searches + dataset probe every ` +
      `${PROBE_MS}ms for ${DURATION_MS}ms against ${ENDPOINT}`,
  );
  const workers = [datasetProbe(), poolMonitor()];
  for (let i = 0; i < OCC_CONC; i += 1) workers.push(occWorker());

  setTimeout(() => {
    stop = true;
  }, DURATION_MS);

  await Promise.allSettled(workers);

  console.log('\n=== dataset-search latency (the canary) ===');
  console.log(`  samples : ${dsLatencies.length}`);
  console.log(`  p50     : ${pct(dsLatencies, 50)?.toFixed(0)}ms`);
  console.log(`  p95     : ${pct(dsLatencies, 95)?.toFixed(0)}ms`);
  console.log(`  max     : ${dsLatencies.length ? Math.max(...dsLatencies).toFixed(0) : 'n/a'}ms`);
  console.log('\n=== occurrence outcomes ===');
  console.log(`  ok        : ${occ.ok}`);
  console.log(`  timed out : ${occ.timeout}   (hit the per-pool timeout)`);
  console.log(`  shed (503): ${occ.shed}   (rejected fast by maxQueueDepth)`);
  console.log(`  other err : ${occ.otherError}`);
  console.log(`  transport : ${occ.transport}   (socket/connection, often client-side)`);
  console.log(
    '\nGood result: dataset p95/max stays low while occurrence backs up as ' +
      'timeouts + 503s. A high `transport` count means the *client* is the ' +
      'bottleneck (e.g. FD limits) — lower OCC_CONC or run from multiple processes.',
  );
})();
