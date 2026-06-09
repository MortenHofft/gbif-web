/**
 * A FIFO request-queue middleware with priority-based load shedding.
 *
 * It caps the number of concurrently in-flight requests (`activeLimit`) and
 * buffers the rest in arrival order. Requests are still served strictly
 * first-come-first-served — we do NOT reorder by priority, so nothing starves.
 *
 * What it adds is shedding under pressure: when the waiting backlog grows past a
 * configured size, the least important requests are dropped — both incoming ones
 * (rejected) and ones already waiting (evicted) — using the same `rejectHandler`.
 * Importance comes from the `x-client-priority` header (1-100, lower = more
 * important) that Varnish attaches and the graphql-api forwards.
 *
 * Shedding is expressed as bands of `{ queueAbove, maxPriority }`: while the
 * backlog length exceeds `queueAbove`, only requests with priority
 * `<= maxPriority` are kept; anything less important is shed. The most severe
 * matching band wins, e.g.
 *
 *     [{ queueAbove: 200, maxPriority: 30 }, { queueAbove: 80, maxPriority: 49 }]
 *
 * means: over 80 waiting -> drop priority >= 50; over 200 waiting -> drop
 * priority > 30. An empty band list disables shedding (plain FIFO).
 *
 * Options:
 *   - activeLimit:     max concurrent in-flight requests (default 1).
 *   - queuedLimit:     hard cap on the backlog; beyond it every request is
 *                      rejected regardless of priority (default unlimited).
 *   - rejectHandler:   (req, res) => void, used for both rejects and evictions.
 *   - shedBands:       array of { queueAbove, maxPriority } (default []).
 *   - defaultPriority: priority when the header is missing/invalid (default 100,
 *                      i.e. least important, so unlabelled traffic sheds first).
 *   - header:          header name to read (default 'x-client-priority').
 *
 * A request occupies a slot from the moment it starts until its response
 * finishes (or the client disconnects); a request that disconnects while still
 * waiting is dropped so we never do work nobody is waiting for.
 */

const DEFAULT_HEADER = 'x-client-priority';
const DEFAULT_PRIORITY = 100;

function defaultRejectHandler(req, res) {
  res.status(429).json({ error: 429, message: 'Too many concurrent requests.' });
}

// express-queue treats a non-positive / -1 limit as "no limit"; keep that.
function normalizeLimit(value, fallback) {
  if (value === undefined || value === null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return Infinity;
  return n;
}

function sheddingQueue(options = {}) {
  const activeLimit = normalizeLimit(options.activeLimit, 1);
  const queuedLimit = normalizeLimit(options.queuedLimit, Infinity);
  const rejectHandler = options.rejectHandler || defaultRejectHandler;
  const defaultPriority = Number.isFinite(options.defaultPriority)
    ? options.defaultPriority
    : DEFAULT_PRIORITY;
  const header = options.header || DEFAULT_HEADER;
  // Keep only well-formed bands, most severe first (largest queueAbove first),
  // so the first one whose threshold is exceeded is the strictest that applies.
  const shedBands = (Array.isArray(options.shedBands) ? options.shedBands : [])
    .filter(
      (b) =>
        b && Number.isFinite(b.queueAbove) && Number.isFinite(b.maxPriority),
    )
    .sort((a, b) => b.queueAbove - a.queueAbove);

  let active = 0;
  const waiting = [];

  function readPriority(req) {
    const raw = req.headers && req.headers[header];
    const n = parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
    if (!Number.isFinite(n)) return defaultPriority;
    // clamp into the documented 1-100 range
    return Math.min(100, Math.max(1, n));
  }

  // The worst (highest) priority number we will still keep given the current
  // backlog length. Infinity = no band active, keep everything.
  function maxPriorityFor(queueLength) {
    for (let i = 0; i < shedBands.length; i += 1) {
      if (queueLength > shedBands[i].queueAbove) return shedBands[i].maxPriority;
    }
    return Infinity;
  }

  // Drop already-waiting requests that no longer meet the threshold.
  function evictBelow(maxPriority) {
    if (!Number.isFinite(maxPriority)) return;
    for (let i = waiting.length - 1; i >= 0; i -= 1) {
      const job = waiting[i];
      if (job.priority > maxPriority) {
        waiting.splice(i, 1);
        job.state = 'evicted';
        rejectHandler(job.req, job.res);
      }
    }
  }

  function run(job) {
    job.state = 'active';
    active += 1;
    let settled = false;
    const release = () => {
      if (settled) return;
      settled = true;
      active -= 1;
      startNext();
    };
    // A request holds its slot until the response is sent or the client leaves.
    job.res.once('finish', release);
    job.res.once('close', release);
    job.next();
  }

  function startNext() {
    if (active >= activeLimit || waiting.length === 0) return;
    const job = waiting.shift(); // FIFO
    run(job);
  }

  const middleware = function sheddingQueueMiddleware(req, res, next) {
    const job = {
      req,
      res,
      next,
      priority: readPriority(req),
      state: 'waiting',
    };

    // A slot is free -> run now. By invariant the backlog is empty when a slot
    // is free, so there is nothing to shed.
    if (active < activeLimit) {
      run(job);
      return;
    }

    // Backlog at the hard cap -> reject regardless of priority.
    if (waiting.length >= queuedLimit) {
      rejectHandler(req, res);
      return;
    }

    // Under backlog pressure, shed the least important: evict waiting requests
    // that fall below the current threshold, and reject this one if it does too.
    const maxPriority = maxPriorityFor(waiting.length);
    if (Number.isFinite(maxPriority)) {
      evictBelow(maxPriority);
      if (job.priority > maxPriority) {
        rejectHandler(req, res);
        return;
      }
    }

    waiting.push(job);
    // Drop the job if the client disconnects before it ever gets a slot.
    res.once('close', () => {
      if (job.state !== 'waiting') return;
      const i = waiting.indexOf(job);
      if (i !== -1) waiting.splice(i, 1);
    });
  };

  // Minimal introspection, mirroring the `.queue` handle express-queue exposes.
  middleware.queue = {
    getLength: () => waiting.length,
    getActiveCount: () => active,
  };
  return middleware;
}

module.exports = sheddingQueue;
