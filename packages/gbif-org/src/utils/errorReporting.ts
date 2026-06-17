/**
 * Lightweight client-side error reporting.
 *
 * Captures uncaught errors and unhandled promise rejections in the browser and
 * ships a small JSON payload to our own backend (`/api/telemetry/error`), which
 * forwards it into the existing ECS winston logger -> Elasticsearch -> Kibana.
 *
 * Design goals:
 *  - Never throw. Reporting must not be able to break the app or cause loops.
 *  - SSR safe. All entry points no-op when there is no `window`.
 *  - Cheap and quiet. Dedupe, sample and cap so we don't flood the log index
 *    with the same error (e.g. a render loop) or with known browser noise.
 *
 * No third-party service is involved - the data stays on GBIF infrastructure.
 */

type ReportKind = 'window.onerror' | 'unhandledrejection' | 'react' | 'recoverable' | 'manual';

type ErrorPayload = {
  message: string;
  name?: string;
  stack?: string;
  kind: ReportKind;
  url?: string;
  pathname?: string;
  referrer?: string;
  userAgent?: string;
  language?: string;
  release?: string;
  source?: string;
  lineno?: number;
  colno?: number;
  timestamp: string;
  context?: Record<string, unknown>;
};

// Where to send reports. Same-origin by default so it is covered by the existing
// CSP (`connect-src` falls back to `default-src 'self'`) and needs no extra config.
const ENDPOINT = (import.meta.env.PUBLIC_TELEMETRY_ENDPOINT ?? '/api/telemetry/error') as string;

// A build/release identifier so dashboards can correlate error spikes with deploys.
const RELEASE = (import.meta.env.PUBLIC_RELEASE ?? 'unknown') as string;

// Fraction of events to send (0..1). Override with PUBLIC_TELEMETRY_SAMPLE_RATE.
const SAMPLE_RATE = clampRate(import.meta.env.PUBLIC_TELEMETRY_SAMPLE_RATE, 1);

// Field caps to keep payloads small and predictable.
const MAX_MESSAGE = 1000;
const MAX_STACK = 8000;
const MAX_URL = 2000;
const MAX_UA = 500;

// Per-page-session caps. These reset on a full page load, which is exactly what we
// want: a single buggy session can report a handful of distinct errors but cannot
// turn a render loop into thousands of requests.
const MAX_EVENTS_PER_SESSION = 25;

// Substrings of error messages that are noise rather than actionable bugs.
// `Script error.` is what browsers report for errors thrown by cross-origin
// scripts (extensions, third-party widgets) where we get no useful detail.
const IGNORED_MESSAGES = [
  'ResizeObserver loop limit exceeded',
  'ResizeObserver loop completed with undelivered notifications',
  'Script error.',
  'Script error',
  // React/Vite internal signal used by our staticRenderSuspence helper.
  'This component should not be rendered on the server.',
  // User-aborted fetches / navigations.
  'The operation was aborted',
  'AbortError',
  'Non-Error promise rejection captured',
];

const seenSignatures = new Set<string>();
let eventsSent = 0;
let initialised = false;

function clampRate(value: unknown, fallback: number): number {
  const n = typeof value === 'string' ? parseFloat(value) : typeof value === 'number' ? value : NaN;
  if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
  return fallback;
}

function isEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  // Disable explicitly by setting the endpoint to an empty string or "false".
  if (ENDPOINT === '' || ENDPOINT === 'false') return false;
  // In dev we stay quiet unless an endpoint was explicitly configured, to avoid
  // spamming the logs with HMR / hot-reload noise while developing.
  if (!import.meta.env.PROD && import.meta.env.PUBLIC_TELEMETRY_ENDPOINT == null) return false;
  return true;
}

function truncate(value: string | undefined, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.length > max ? `${value.slice(0, max)}…[truncated]` : value;
}

function toErrorParts(error: unknown): { name?: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  if (typeof error === 'string') return { message: error };
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

function isIgnored(message: string): boolean {
  return IGNORED_MESSAGES.some((ignored) => message.includes(ignored));
}

function send(payload: ErrorPayload): void {
  try {
    const body = JSON.stringify(payload);
    // sendBeacon survives page unload (e.g. an error thrown while navigating away)
    // and does not delay the user. Fall back to keepalive fetch where unavailable.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      // No credentials needed - this is anonymous diagnostic data.
      credentials: 'omit',
    }).catch(() => {
      /* swallow - reporting failures must never surface to the user */
    });
  } catch {
    /* never throw from the reporter */
  }
}

/**
 * Report a single error. Safe to call from anywhere (no-ops on the server).
 */
export function reportClientError(
  error: unknown,
  options: { kind?: ReportKind; context?: Record<string, unknown>; source?: string; lineno?: number; colno?: number } = {}
): void {
  try {
    if (!isEnabled()) return;
    if (eventsSent >= MAX_EVENTS_PER_SESSION) return;

    const { name, message, stack } = toErrorParts(error);
    if (!message || isIgnored(message)) return;

    // Dedupe identical errors within the session (render loops, repeated handlers).
    const signature = `${name ?? ''}:${message}:${(stack ?? '').split('\n')[1] ?? ''}`;
    if (seenSignatures.has(signature)) return;

    // Client-side sampling. Dedupe runs first so we don't "sample away" the only
    // copy of an error and then let its duplicates through.
    if (SAMPLE_RATE < 1 && Math.random() > SAMPLE_RATE) {
      seenSignatures.add(signature);
      return;
    }

    seenSignatures.add(signature);
    eventsSent += 1;

    send({
      message: truncate(message, MAX_MESSAGE) ?? 'Unknown error',
      name,
      stack: truncate(stack, MAX_STACK),
      kind: options.kind ?? 'manual',
      url: truncate(window.location?.href, MAX_URL),
      pathname: window.location?.pathname,
      referrer: truncate(document?.referrer || undefined, MAX_URL),
      userAgent: truncate(navigator?.userAgent, MAX_UA),
      language: navigator?.language,
      release: RELEASE,
      source: options.source,
      lineno: options.lineno,
      colno: options.colno,
      timestamp: new Date().toISOString(),
      context: options.context,
    });
  } catch {
    /* never throw from the reporter */
  }
}

/**
 * Install global handlers for uncaught errors and unhandled promise rejections.
 * Idempotent and browser-only. Call once during client hydration.
 */
export function initClientErrorReporting(): void {
  if (initialised || typeof window === 'undefined') return;
  initialised = true;

  window.addEventListener('error', (event: ErrorEvent) => {
    // Resource load errors (img/script 404s) also fire "error" but have no `error`
    // and bubble with a target element - skip those, they are not exceptions.
    if (!event.error && !event.message) return;
    reportClientError(event.error ?? event.message, {
      kind: 'window.onerror',
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    reportClientError(event.reason, { kind: 'unhandledrejection' });
  });
}
