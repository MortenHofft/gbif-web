import { AsyncLocalStorage } from 'async_hooks';

// Fields that should be attached to every log line emitted while a single
// request is being handled. Kept intentionally small — this is request-scoped
// observability metadata, not application state.
export type RequestLogContext = {
  // The full URL of the page that issued the request, sent by the portal as the
  // `x-gbif-site-url` header. Null when the header is absent.
  siteUrl?: string | null;
};

// Per-request store. The express middleware in index.ts opens a store for each
// incoming request; logger.ts merges its fields into every log entry written
// within that request's async context. Outside a request (startup, cache
// warmers, interval tasks) `getStore()` returns undefined and logs are
// unaffected.
export const requestContextStorage =
  new AsyncLocalStorage<RequestLogContext>();

export function getRequestLogContext(): RequestLogContext | undefined {
  return requestContextStorage.getStore();
}
