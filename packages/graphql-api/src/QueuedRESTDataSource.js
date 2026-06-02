import { RESTDataSource } from '@/RESTDataSource';
import { runInPool, withPoolTimeout } from '@/requestPools';

/**
 * A data source whose `enQueue: true` requests are gated by a process-wide
 * concurrency limit for its upstream pool (see requestPools.ts). Previously each
 * data source instance (and we create a fresh set per request) owned its own
 * queue, so the limit was per-request and there was no global ceiling — a slow
 * upstream could accumulate unbounded in-flight requests across requests. The
 * queue is now shared per pool, so the cap is enforced for the whole process and
 * one slow upstream cannot starve the others.
 *
 * Pass `{ pool }` from the subclass to pick the bulkhead (e.g. 'occurrence').
 */
class QueuedRESTDataSource extends RESTDataSource {
  constructor(options = {}) {
    super();
    this.pool = options.pool ?? 'default';
  }

  // Wrap a request so it runs under the pool's concurrency limit, with a total
  // (queue + wire) timeout. If the caller's signal already aborted while the job
  // was waiting in the queue we skip the upstream call entirely — there is no
  // point hammering an already-slow service with requests nobody is waiting for.
  #enqueue(init, run) {
    const initWithTimeout = withPoolTimeout(this.pool, init);
    return runInPool(this.pool, () => {
      const { signal } = initWithTimeout;
      if (signal?.aborted) {
        throw signal.reason ?? new Error('Request aborted while queued');
      }
      return run(initWithTimeout);
    });
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
