// Load driver for the gbif-org-ssr dataset page.
//
// Fires requests at /dataset/<random-uuid>, varying the key every request so nothing is
// cacheable and every request forces a fresh server-side render. Prints latency percentiles +
// throughput.
//
//   TARGET       SSR base url            (default http://localhost:3100)
//   PATH         path template, <id> replaced per request  (default /dataset/<id>)
//   DURATION     seconds                 (default 20)
//   CONNECTIONS  concurrent connections  (default 50)
//   RPS          target req/s (paced)    (default 0 = uncapped max-throughput)
//
// Example:  CONNECTIONS=50 DURATION=20 npm run loadtest:run
import autocannon from 'autocannon';

const TARGET = process.env.TARGET || 'http://localhost:3100';
const PATH = process.env.PATH_TEMPLATE || '/dataset/<id>';
const DURATION = parseInt(process.env.DURATION || '20', 10);
const CONNECTIONS = parseInt(process.env.CONNECTIONS || '50', 10);
const RPS = parseInt(process.env.RPS || '0', 10);
const MAX = RPS === 0;

// Random v4-ish UUID so each request is a unique, uncacheable key.
const hex = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-${hex(4)}-${hex(12)}`;

console.log(
  `Load test -> ${TARGET}${PATH}\n` +
    `  rate=${MAX ? 'UNCAPPED (max)' : `${RPS} req/s`}  duration=${DURATION}s  connections=${CONNECTIONS}\n`
);

const instance = autocannon(
  {
    url: TARGET,
    connections: CONNECTIONS,
    duration: DURATION,
    ...(MAX ? {} : { overallRate: RPS }),
    requests: [
      {
        method: 'GET',
        setupRequest: (req) => {
          req.path = PATH.replace('<id>', uuid());
          return req;
        },
      },
    ],
  },
  (err, result) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    const r2 = (n) => Math.round(n * 100) / 100;
    console.log('\n=== RESULTS ===');
    console.log(`throughput : ${r2(result.requests.average)} req/s avg`);
    console.log(`latency    : ${result.latency.mean} ms mean, p50 ${result.latency.p50}, p97_5 ${result.latency.p97_5}, max ${result.latency.max}`);
    console.log(`2xx        : ${result.non2xx === 0 ? 'all 2xx' : `non-2xx ${result.non2xx}`}`);
    console.log(`bytes/sec  : ${r2(result.throughput.average / 1024)} KB/s`);
  }
);

autocannon.track(instance, { renderProgressBar: true });
