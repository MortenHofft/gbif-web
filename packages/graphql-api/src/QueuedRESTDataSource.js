import { RESTDataSource } from '@/RESTDataSource';
import PQueue from 'p-queue';
import {
  runInPool,
  withPoolTimeout,
  poolPerRequestConcurrency,
} from '@/requestPools';

// Default retry policy. Opt-in per call via `{ retry: true }` (1 retry) or
// `{ retry: <n> }`. GET/HEAD only — we never auto-retry non-idempotent methods.
const DEFAULT_RETRIES = 1;
const RETRY_BASE_DELAY_MS = 200;
const RETRY_MAX_DELAY_MS = 2000;
const RETRY_JITTER_MS = 100;

function maxRetriesFrom(retry) {
  if (retry === true) return DEFAULT_RETRIES;
  if (Number.isInteger(retry) && retry > 0) return retry;
  return 0;
}

// Retry only transient failures, and never amplify our own backpressure or a
// cancelled request:
//  - AbortError (client disconnect / pool timeout) -> never retry.
//  - our overload shed (loadShed marker) -> never retry into our own 503.
//  - no HTTP status -> a connection/network error -> retry.
//  - 429 or 5xx -> retry. Any other 4xx -> don't (won't change).
function isRetryable(err) {
  if (err?.name === 'AbortError') return false;
  if (err?.extensions?.loadShed) return false;
  const status =
    err?.extensions?.http?.status ?? err?.extensions?.response?.status;
  if (status == null) return true;
  if (status === 429) return true;
  return status >= 500 && status <= 599;
}

function backoffDelay(attempt) {
  const exp = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
  return Math.min(exp, RETRY_MAX_DELAY_MS) + Math.random() * RETRY_JITTER_MS;
}

// A sleep that rejects immediately if the (client/timeout) signal aborts, so we
// don't sit in backoff for a request nobody is waiting for.
function abortableDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('aborted'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error('aborted'));
      },
      { once: true },
    );
  });
}

/**
 * A data source whose `enQueue: true` requests are subject to a two-level
 * concurrency limit (per-request queue + shared pool; see requestPools.ts) and
 * which supports an opt-in, idempotent-only `retry`.
 *
 * Per-call options:
 *  - `enQueue`: run through the per-request queue and the shared pool.
 *  - `retry`: `true` (1 retry) or a number. Applies to GET only. Retries network
 *    errors, 5xx and 429 with jittered exponential backoff; never retries a
 *    4xx, a cancelled request, or our own overload 503. Backoff and retries
 *    respect the abort/timeout signal, so a cancelled request stops immediately.
 *    NOTE: when combined with `enQueue`, retries (and their backoff) happen while
 *    holding the pool slot — fine for low retry counts, and bounded by the pool's
 *    concurrency cap.
 */
class QueuedRESTDataSource extends RESTDataSource {
  constructor(options = {}) {
    super();
    this.pool = options.pool ?? 'default';
    this.requestQueue = new PQueue({
      concurrency: options.concurrency ?? poolPerRequestConcurrency(this.pool),
    });
  }

  // Retry an idempotent call. `run` performs one attempt; `signal` (if any) cuts
  // retries short on cancellation/timeout. With maxRetries 0 this is a single
  // pass-through call.
  // eslint-disable-next-line class-methods-use-this
  async #withRetry(retry, signal, run) {
    const maxRetries = maxRetriesFrom(retry);
    let attempt = 0;
    for (;;) {
      try {
        // eslint-disable-next-line no-await-in-loop
        return await run();
      } catch (err) {
        attempt += 1;
        if (attempt > maxRetries || signal?.aborted || !isRetryable(err)) {
          throw err;
        }
        // eslint-disable-next-line no-await-in-loop
        await abortableDelay(backoffDelay(attempt), signal);
      }
    }
  }

  // Run through the per-request queue and the shared pool, with a total
  // (queue + wire) timeout. Skip the upstream call entirely if the caller's
  // signal already aborted while the job was waiting. `retry` (idempotent calls
  // only) wraps the upstream attempt.
  #enqueue(init, retry, run) {
    const initWithTimeout = withPoolTimeout(this.pool, init);
    const { signal } = initWithTimeout;
    return this.requestQueue.add(() =>
      runInPool(this.pool, () => {
        if (signal?.aborted) {
          throw signal.reason ?? new Error('Request aborted while queued');
        }
        return this.#withRetry(retry, signal, () => run(initWithTimeout));
      }),
    );
  }

  // GET is idempotent — the only method we retry.
  async get(path, params, { enQueue, retry, ...init } = {}) {
    if (enQueue) {
      return this.#enqueue(init, retry, (i) => super.get(path, params, i));
    }
    return this.#withRetry(retry, init.signal, () =>
      super.get(path, params, init),
    );
  }

  // Non-idempotent methods are never auto-retried (retry is dropped).
  async post(path, body, { enQueue, retry, ...init } = {}) {
    if (enQueue) {
      return this.#enqueue(init, 0, (i) => super.post(path, body, i));
    }
    return super.post(path, body, init);
  }

  async put(path, body, { enQueue, retry, ...init } = {}) {
    if (enQueue) {
      return this.#enqueue(init, 0, (i) => super.put(path, body, i));
    }
    return super.put(path, body, init);
  }

  async patch(path, body, { enQueue, retry, ...init } = {}) {
    if (enQueue) {
      return this.#enqueue(init, 0, (i) => super.patch(path, body, i));
    }
    return super.patch(path, body, init);
  }

  async delete(path, params, { enQueue, retry, ...init } = {}) {
    if (enQueue) {
      return this.#enqueue(init, 0, (i) => super.delete(path, params, i));
    }
    return super.delete(path, params, init);
  }
}

export default QueuedRESTDataSource;
