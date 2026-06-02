import PQueue from 'p-queue';
import { get } from 'lodash';
import config from './config';
import type { PoolName } from './requestAgents';

/**
 * Per-upstream "bulkheads".
 *
 * Each upstream the GraphQL API talks to (es-api/occurrence, the experimental
 * taxon API, the general v1 API, ...) is given its own process-wide concurrency
 * limit. Because the whole service runs in a single Node process — one event
 * loop, one heap/GC, one libuv threadpool — an upstream that goes slow can,
 * without a cap, accumulate unbounded in-flight requests. That pile of pending
 * work (open sockets + buffered responses + live operation state) drives memory
 * and GC pressure that stalls the event loop and slows *every* endpoint, even
 * ones that never touch the slow upstream (e.g. dataset search).
 *
 * A shared, bounded queue per pool isolates that blast radius: when es-api
 * grinds to a halt only es-api-backed work backs up, while the rest of the
 * process keeps its headroom. This is the bulkhead pattern.
 *
 * NOTE: the queue alone is not enough — if every running slot is stuck on a
 * hung upstream the queue never drains. The per-pool request timeout
 * (see `withPoolTimeout` / `requestAgents.ts`) is what recycles slots so the
 * pool recovers instead of dead-locking.
 *
 * All limits are configurable per pool via `.env` (`requestPools.<pool>.*`).
 * The default concurrency is `Infinity` (behaviour-neutral) so enabling a cap
 * is an explicit, tunable decision per environment.
 */

const DEFAULT_TIMEOUT_MS = 30000; // conservative: only abort genuinely stuck requests

// One shared queue per pool, created lazily and kept for the life of the process.
const queues = new Map<PoolName, PQueue>();

function resolveConcurrency(pool: PoolName): number {
  const value = get(config, ['requestPools', pool, 'concurrency'], Infinity);
  // Treat null / 0 / "unbounded" as "no limit" so it can be turned off in config.
  if (value === null || value === undefined || value === 0 || value === 'unbounded') {
    return Infinity;
  }
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
}

export function poolTimeoutMs(pool: PoolName): number {
  const value = get(config, ['requestPools', pool, 'timeoutMs'], DEFAULT_TIMEOUT_MS);
  if (value === null || value === undefined || value === 'none') return Infinity;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

export function getPoolQueue(pool: PoolName): PQueue {
  let queue = queues.get(pool);
  if (!queue) {
    queue = new PQueue({ concurrency: resolveConcurrency(pool) });
    queues.set(pool, queue);
  }
  return queue;
}

/** Run `fn` under the process-wide concurrency limit for `pool`. */
export function runInPool<T>(pool: PoolName, fn: () => Promise<T>): Promise<T> {
  return getPoolQueue(pool).add(fn) as Promise<T>;
}

/**
 * Return a copy of `init` whose `signal` aborts after the pool's timeout, in
 * addition to any signal already present (e.g. the per-request abort signal that
 * fires when the client disconnects). The timeout budget is created here, before
 * the request is enqueued, so it covers *both* time spent waiting in the queue
 * and time spent on the wire — a request can never be stuck longer than the
 * configured budget regardless of where the time goes.
 */
export function withPoolTimeout<T extends { signal?: AbortSignal }>(
  pool: PoolName,
  init: T,
): T {
  const ms = poolTimeoutMs(pool);
  if (!Number.isFinite(ms)) return init;
  const timeoutSignal = AbortSignal.timeout(ms);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;
  return { ...init, signal };
}

/** Lightweight snapshot for diagnostics / health output. */
export function getPoolStats() {
  const stats: Record<string, { size: number; pending: number; concurrency: number }> = {};
  for (const [pool, queue] of queues.entries()) {
    stats[pool] = {
      size: queue.size, // waiting in the queue
      pending: queue.pending, // currently running
      concurrency:
        queue.concurrency === Infinity ? -1 : (queue.concurrency as number),
    };
  }
  return stats;
}
