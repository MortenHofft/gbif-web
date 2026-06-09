import config from './config';
import logger from './logger';

// The cors middleware's options object. We keep a local structural type because
// the `cors` package ships no types and `@types/cors` is not installed; this
// documents the shape we rely on without taking on a new dependency.
type CorsOptions = {
  methods?: string;
  origin?:
    | boolean
    | ((
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => void);
};

// We only ever expose these verbs (GET + POST for queries, OPTIONS for the
// CORS preflight). Kept here so the value lives next to the rest of the CORS
// policy instead of being a magic string in index.ts.
const ALLOWED_METHODS = 'GET,POST,OPTIONS';

/**
 * Build a predicate that decides whether a browser Origin is allowed.
 *
 * Each entry in `allowedOrigins` is one of:
 *   - an exact origin, e.g. "https://www.gbif.org"
 *   - a wildcard subdomain, e.g. "*.gbif.org", which matches any host ending in
 *     ".gbif.org" as well as the apex "gbif.org" (over http or https)
 *   - "*" to allow every origin
 *
 * Matching is case-insensitive. Unparseable origins never match.
 */
export function createOriginMatcher(
  allowedOrigins: string[] = [],
): (origin: string) => boolean {
  const exact = new Set<string>();
  const wildcardSuffixes: string[] = []; // e.g. ".gbif.org"
  let allowAll = false;

  for (const entry of allowedOrigins) {
    if (!entry) continue;
    const value = entry.trim().toLowerCase();
    if (value === '*') {
      allowAll = true;
    } else if (value.startsWith('*.')) {
      wildcardSuffixes.push(value.slice(1)); // "*.gbif.org" -> ".gbif.org"
    } else {
      exact.add(value);
    }
  }

  return (origin: string): boolean => {
    if (allowAll) return true;
    const normalized = origin.toLowerCase();
    if (exact.has(normalized)) return true;
    if (wildcardSuffixes.length === 0) return false;

    let host: string;
    try {
      ({ host } = new URL(normalized));
    } catch {
      return false;
    }
    return wildcardSuffixes.some(
      (suffix) => host.endsWith(suffix) || host === suffix.slice(1),
    );
  };
}

/**
 * Build the CORS options used by the express `cors` middleware.
 *
 * - In non-production environments (the default) all origins are allowed so the
 *   public sandbox stays open for experimentation.
 * - In production — or whenever `cors.allowAllOrigins` is explicitly false — only
 *   the origins listed in `cors.allowedOrigins` are accepted.
 *
 * NOTE: CORS is a *browser* protection only. It does not stop non-browser
 * clients (curl, scripts, server-to-server calls) — those can omit or spoof the
 * Origin header. Requests without an Origin header are therefore always allowed
 * through. Treat this as a guard against casual embedding/abuse from third-party
 * web pages, not as authentication or rate limiting. See README for the broader
 * abuse-protection options (rate limiting, depth/complexity limits, persisted
 * queries, API keys).
 */
export function buildCorsOptions(): CorsOptions {
  const allowAll: boolean =
    config.cors?.allowAllOrigins ?? config.environment !== 'prod';

  if (allowAll) {
    // Reflect the request origin (rather than a literal "*") so that, should we
    // ever start relying on credentialed requests, this keeps working.
    return { origin: true, methods: ALLOWED_METHODS };
  }

  const allowedOrigins: string[] = config.cors?.allowedOrigins ?? [];
  const isAllowed = createOriginMatcher(allowedOrigins);

  if (allowedOrigins.length === 0) {
    logger.warn(
      'CORS: running with an empty allowlist (cors.allowedOrigins) in a ' +
        'restricted environment — all cross-origin browser requests will be blocked.',
    );
  }

  return {
    methods: ALLOWED_METHODS,
    origin(origin, callback) {
      // No Origin header => not a cross-origin browser request (server-to-server,
      // curl, same-origin navigation). CORS neither can nor should block these.
      if (!origin || isAllowed(origin)) {
        callback(null, true);
        return;
      }
      logger.warn(`CORS: blocked request from disallowed origin "${origin}"`);
      // Resolve without the Access-Control-Allow-Origin header instead of
      // throwing (a thrown error would surface as a 500). The browser then
      // blocks the response on the client side, which is the desired outcome.
      callback(null, false);
    },
  };
}
