import { RESTDataSource } from '@/RESTDataSource';
import PQueue from 'p-queue';
import {
  runInPool,
  withPoolTimeout,
  poolPerRequestConcurrency,
} from '@/requestPools';

/**
 * A data source whose `enQueue: true` requests are subject to a two-level
 * concurrency limit:
 *
 *  1. A per-instance queue (this class). Data sources are created per GraphQL
 *     request, so this caps how many of *one request's* enQueued calls run at
 *     once — important because a single query can fan out into many es-api calls
 *     (e.g. occurrence search resolves each requested facet/stat/histogram field
 *     as its own search). This is the fairness layer: one greedy query cannot
 *     monopolise the shared pool.
 *
 *  2. The process-wide pool (requestPools.ts), shared across all requests. This
 *     is the protection layer: it caps total in-flight work for the upstream,
 *     sheds beyond maxQueueDepth, and applies the per-request timeout.
 *
 * Pass `{ pool }` to pick the upstream bulkhead and, optionally, `{ concurrency }`
 * to override the per-request cap (defaults to the pool's configured value).
 */
class QueuedRESTDataSource extends RESTDataSource {
  constructor(options = {}) {
    super();
    this.pool = options.pool ?? 'default';
    this.requestQueue = new PQueue({
      concurrency: options.concurrency ?? poolPerRequestConcurrency(this.pool),
    });
  }

  // Run a request through the per-request queue and then the shared pool, with a
  // total (queue + wire) timeout. If the caller's signal already aborted while
  // the job was waiting we skip the upstream call — no point hammering an
  // already-slow service with requests nobody is waiting for.
  #enqueue(init, run) {
    const initWithTimeout = withPoolTimeout(this.pool, init);
    return this.requestQueue.add(() =>
      runInPool(this.pool, () => {
        const { signal } = initWithTimeout;
        if (signal?.aborted) {
          throw signal.reason ?? new Error('Request aborted while queued');
        }
        return run(initWithTimeout);
      }),
    );
  }

  async get(path, params, { enQueue, ...init } = {}) {
    if (enQueue) {
      return this.#enqueue(init, (i) => super.get(path, params, i));
    }
    return super.get(path, params, init);
  }

  async post(path, body, { enQueue, ...init } = {}) {
    if (enQueue) {
      return this.#enqueue(init, (i) => super.post(path, body, i));
    }
    return super.post(path, body, init);
  }

  async put(path, body, { enQueue, ...init } = {}) {
    if (enQueue) {
      return this.#enqueue(init, (i) => super.put(path, body, i));
    }
    return super.put(path, body, init);
  }

  async patch(path, body, { enQueue, ...init } = {}) {
    if (enQueue) {
      return this.#enqueue(init, (i) => super.patch(path, body, i));
    }
    return super.patch(path, body, init);
  }

  async delete(path, params, { enQueue, ...init } = {}) {
    if (enQueue) {
      return this.#enqueue(init, (i) => super.delete(path, params, i));
    }
    return super.delete(path, params, init);
  }
}

export default QueuedRESTDataSource;
