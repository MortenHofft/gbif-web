import { setMaxListeners } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

type ClosableReq = Pick<IncomingMessage, 'once'>;
type ClosableRes = Pick<ServerResponse, 'once' | 'writableEnded'>;

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
 * the queue draining to the upstream. We therefore listen on both.
 *
 * Both streams ALSO emit `'close'` on a normal completion (after the response is
 * sent), so we abort only when the response did not finish — `!res.writableEnded`
 * — to avoid aborting the signal once the work is already done.
 */
export default function abortControllerForRequest(
  req?: ClosableReq,
  res?: ClosableRes,
): AbortController {
  const controller = new AbortController();
  // A single query can fan out into many resolvers that each add a listener to
  // this signal; raise the default cap (10) to avoid spurious leak warnings.
  setMaxListeners(100, controller.signal);

  // Only a premature close (client left before we finished responding) should
  // abort; a 'close' after the response has been sent is a normal end.
  const abortIfUnfinished = () => {
    if (!res?.writableEnded) controller.abort();
  };
  req?.once('close', abortIfUnfinished);
  res?.once('close', abortIfUnfinished);

  return controller;
}

