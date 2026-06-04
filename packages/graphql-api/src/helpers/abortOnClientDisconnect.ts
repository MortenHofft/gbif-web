import { setMaxListeners } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

type Closable = Pick<IncomingMessage | ServerResponse, 'once'>;

/**
 * Build the AbortController for a single GraphQL request. Its `signal` aborts as
 * soon as the client disconnects before we have finished responding, so
 * resolvers and data sources (e.g. the per-request queue in
 * QueuedRESTDataSource) can cancel in-flight upstream calls and drop
 * still-queued ones instead of running the whole operation for a client that
 * has gone away.
 *
 * A premature disconnect can surface as a `'close'` event on the request stream,
 * the response stream, or both — it varies by Node/Express version and by
 * whether the request body was fully read. Listening only on `req` (as we used
 * to) misses cases where it never fires, which is why a closed tab could leave
 * the queue draining to the upstream. We therefore listen on both; `abort()` is
 * idempotent, and a normal completion (which also emits `'close'`, after the
 * resolvers are done) is harmless.
 */
export default function abortControllerForRequest(
  req?: Closable,
  res?: Closable,
): AbortController {
  const controller = new AbortController();
  // A single query can fan out into many resolvers that each add a listener to
  // this signal; raise the default cap (10) to avoid spurious leak warnings.
  setMaxListeners(100, controller.signal);

  const abort = () => controller.abort();
  req?.once('close', abort);
  res?.once('close', abort);

  return controller;
}
