import { monitorEventLoopDelay } from 'node:perf_hooks';
import v8 from 'node:v8';
import logger from '../config/logger.mjs';

/**
 * /health for the gbif-org SSR server.
 *
 * Unlike the graphql-api and es-api — which queue/pool upstream work — this
 * process spends most of its time doing React server-side rendering:
 * synchronous, CPU-bound work that blocks the event loop. So the signal that
 * best explains "the site is slow to respond" is event-loop lag: how far behind
 * the loop is falling. We also report the in-flight request count and heap usage
 * as the supporting "load" picture.
 *
 * Observability only — nothing here sheds or rejects requests. It mirrors the
 * other services' /health in spirit and JSON shape so the backstage admin
 * dashboard can render it the same way.
 *
 * monitorEventLoopDelay arms a timer every RESOLUTION_MS and records the *actual*
 * gap between fires. On an idle loop that gap is already ~RESOLUTION_MS and Node
 * does NOT subtract it back out, so every raw sample carries a ~RESOLUTION_MS
 * floor. We subtract it (clamped at 0) so the reported numbers are *true* lag
 * (how far behind the loop is), not lag + the sampling resolution.
 */
const RESOLUTION_MS = 20;
// Only log a new peak once it represents a meaningful stall, otherwise normal
// jitter would log on every small new high during warmup and spam the logs.
const PEAK_LOG_THRESHOLD_MS = 200;
// Startup (module load, JIT warmup, the first SSR render) reliably stalls the
// loop once. That is a known systemic cost, not load caused by usage, so ignore
// it for peak tracking entirely — otherwise the sticky peak would be pinned to a
// startup spike and suppress logging of later, real stalls.
const STARTUP_GRACE_SECONDS = 10;
const SAMPLE_INTERVAL_MS = 2000;
// A stall this big (a fully blocked loop for >1s) is notable on its own. We
// record when it last happened and how many times, to get a sense of frequency.
const SLOW_EVENT_LOOP_MS = 1000;

const histogram = monitorEventLoopDelay({ resolution: RESOLUTION_MS });
histogram.enable();
const trueLag = (rawMs) => Math.max(0, rawMs - RESOLUTION_MS);

let eventLoopDelayMs = 0; // mean over the most recent window
let eventLoopDelayMaxMs = 0; // worst single sample in the most recent window
let peakEventLoopDelayMs = 0; // sticky worst since process start
let peakEventLoopMetrics = null; // snapshot of process state at that worst stall
let lastSlowEventLoop = null; // ISO time of the last stall over SLOW_EVENT_LOOP_MS
let slowEventLoopCount = 0; // how many such stalls since startup

let inflight = 0; // requests being handled across the server right now

const heapLimitBytes = v8.getHeapStatistics().heap_size_limit;

// Capture what the process was doing when a new worst stall was observed. Note:
// the sampler fires *after* the loop frees up, so this is the state right after
// the stall — the best available approximation, not the instant of the stall.
function captureSnapshot(lagMs) {
  const heapUsed = process.memoryUsage().heapUsed;
  return {
    eventLoopLagMs: Math.round(lagMs * 10) / 10,
    atUptimeSeconds: Math.round(process.uptime() * 10) / 10,
    inflight,
    heapUsedMb: Math.round(heapUsed / 1048576),
    heapUsedPercent: Math.round((heapUsed / heapLimitBytes) * 100),
  };
}

const sampler = setInterval(() => {
  eventLoopDelayMs = trueLag(histogram.mean / 1e6); // ns -> ms, mean since last reset
  eventLoopDelayMaxMs = trueLag(histogram.max / 1e6);
  const afterGrace = process.uptime() >= STARTUP_GRACE_SECONDS;
  if (afterGrace && eventLoopDelayMaxMs > peakEventLoopDelayMs) {
    peakEventLoopDelayMs = eventLoopDelayMaxMs;
    peakEventLoopMetrics = captureSnapshot(peakEventLoopDelayMs);
    // Log the moment a new worst-ever stall is observed, with the surrounding
    // state, so it can be correlated with what the process was doing.
    if (peakEventLoopDelayMs > PEAK_LOG_THRESHOLD_MS) {
      logger.warn('new peak event-loop lag', peakEventLoopMetrics);
    }
  }
  if (afterGrace && eventLoopDelayMaxMs > SLOW_EVENT_LOOP_MS) {
    lastSlowEventLoop = new Date().toISOString();
    slowEventLoopCount += 1;
  }
  histogram.reset();
}, SAMPLE_INTERVAL_MS);
sampler.unref();

function getEventLoopStats() {
  return {
    eventLoopDelayMs: Math.round(eventLoopDelayMs * 10) / 10,
    eventLoopDelayMaxMs: Math.round(eventLoopDelayMaxMs * 10) / 10,
    peakEventLoopDelayMs: Math.round(peakEventLoopDelayMs * 10) / 10,
    // State captured at the worst stall (null until one is recorded).
    peakEventLoopMetrics,
    // When the loop was last stalled for over a second, and how often that has
    // happened since startup — a rough sense of how frequent bad stalls are.
    slowEventLoopThresholdMs: SLOW_EVENT_LOOP_MS,
    lastSlowEventLoop, // ISO timestamp, null until one occurs
    slowEventLoopCount,
  };
}

// Flat, greppable status line for Nagios-style checks (call /health, look for a
// specific string). One token per subsystem, joined by " - ", so a check can
// "expect to see" SERVICE_OPERATIONAL / EVENT_LOOP_OK and alert when it changes.
function buildNagiosString(eventLoop) {
  const tokens = ['SERVICE_OPERATIONAL'];
  const slow = eventLoop.eventLoopDelayMaxMs > SLOW_EVENT_LOOP_MS;
  tokens.push(`EVENT_LOOP_${slow ? 'SLOW' : 'OK'}`);
  return tokens.join(' - ');
}

// Express middleware: count a request as in-flight for the whole server while it
// is being handled. /health probes are excluded so they do not inflate it.
function trackInflight(req, res, next) {
  if (req.path === '/health') {
    next();
    return;
  }
  inflight += 1;
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      if (inflight > 0) inflight -= 1;
    }
  };
  res.once('finish', release);
  res.once('close', release);
  next();
}

/**
 * Wire up health monitoring on the app: the in-flight tracker (added first so it
 * sees every request) and the /health endpoint itself. Call early in server
 * setup, before the routes whose load we want to measure.
 */
export function register(app) {
  app.use(trackInflight);

  app.get('/health', (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const eventLoop = getEventLoopStats();
      const heapUsed = process.memoryUsage().heapUsed;
      res.json({
        status: 'ok',
        // Flat, greppable status line for Nagios-style string checks.
        nagiosString: buildNagiosString(eventLoop),
        // seconds since the process started.
        uptimeSeconds: Math.round(process.uptime()),
        // time when the process started, as an ISO timestamp.
        uptimeStarted: new Date(Date.now() - process.uptime() * 1000).toISOString(),
        // requests being handled across the whole server right now.
        inflight,
        // process memory pressure.
        heapUsedMb: Math.round(heapUsed / 1048576),
        heapUsedPercent: Math.round((heapUsed / heapLimitBytes) * 100),
        // Event-loop lag (ms): mean and max over the last window, plus the sticky
        // worst since startup. This is the primary "why is SSR slow" signal.
        eventLoop,
      });
    } catch (err) {
      logger.logError(err instanceof Error ? err : new Error(String(err)), {
        message: '/health failed',
      });
      res.sendStatus(500);
    }
  });
}
