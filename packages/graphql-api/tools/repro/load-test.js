/* eslint-disable no-console */
/**
 * Cascade reproduction / verification load test.
 *
 * Hammers the GraphQL API with concurrent *occurrence* searches (which hit
 * es-api, made slow by delay-proxy.js) while, on a separate cadence, issuing
 * *dataset* searches (which hit the v1 API and should stay fast). It reports the
 * dataset-search latency over time — the thing that should NOT degrade if the
 * es-api bulkhead is doing its job.
 *
 *   Baseline (bug):  set requestPools.occurrence.concurrency: unbounded
 *   Fixed:           set requestPools.occurrence.concurrency: <small number>
 *
 * Env vars:
 *   ENDPOINT      graphql endpoint     (default http://localhost:4123/graphql)
 *   OCC_CONC      concurrent occurrence searches kept in flight (default 50)
 *   DURATION_MS   how long to run      (default 30000)
 *   PROBE_MS      dataset probe period (default 1000)
 */
const ENDPOINT = process.env.ENDPOINT || 'http://localhost:4123/graphql';
const OCC_CONC = Number(process.env.OCC_CONC || 50);
const DURATION_MS = Number(process.env.DURATION_MS || 30000);
const PROBE_MS = Number(process.env.PROBE_MS || 1000);

// Adjust these selections if the schema changes.
const OCC_QUERY = `query Occ { occurrenceSearch(predicate: { type: equals, key: "country", value: "DK" }) { documents { total } } }`;
const DS_QUERY = `query Ds { datasetSearch(q: "") { count } }`;

let stop = false;
let occCompleted = 0;
let occErrors = 0;
const dsLatencies = [];

async function gql(query) {
  const t0 = performance.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  await res.text(); // drain body
  return { ms: performance.now() - t0, status: res.status };
}

async function occWorker() {
  while (!stop) {
    try {
      await gql(OCC_QUERY);
      occCompleted += 1;
    } catch {
      occErrors += 1;
    }
  }
}

async function datasetProbe() {
  while (!stop) {
    const start = performance.now();
    try {
      const { ms, status } = await gql(DS_QUERY);
      dsLatencies.push(ms);
      console.log(
        `dataset probe: ${ms.toFixed(0)}ms (status ${status})  ` +
          `[occ done=${occCompleted} err=${occErrors}]`,
      );
    } catch (e) {
      console.log(`dataset probe FAILED: ${e.message}`);
    }
    const elapsed = performance.now() - start;
    await new Promise((r) => setTimeout(r, Math.max(0, PROBE_MS - elapsed)));
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
  const workers = [datasetProbe()];
  for (let i = 0; i < OCC_CONC; i += 1) workers.push(occWorker());

  setTimeout(() => {
    stop = true;
  }, DURATION_MS);

  await Promise.allSettled(workers);

  console.log('\n=== dataset-search latency (the canary) ===');
  console.log(`  samples : ${dsLatencies.length}`);
  console.log(`  p50     : ${pct(dsLatencies, 50)?.toFixed(0)}ms`);
  console.log(`  p95     : ${pct(dsLatencies, 95)?.toFixed(0)}ms`);
  console.log(`  max     : ${Math.max(...dsLatencies).toFixed(0)}ms`);
  console.log(`  occurrence completed=${occCompleted} errors=${occErrors}`);
  console.log(
    '\nIf dataset p95/max stays low while occurrence backs up, the bulkhead works.',
  );
})();
