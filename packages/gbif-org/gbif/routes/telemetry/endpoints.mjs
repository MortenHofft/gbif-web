// Telemetry ingest for client-side errors.
//
// Receives the small JSON payloads produced by src/utils/errorReporting.ts and
// funnels them into the same ECS winston logger the server already uses, tagged
// `class: 'client'` so they land in Elasticsearch / Kibana alongside (but
// distinguishable from) server logs. No third-party service is involved.
//
// The endpoint is deliberately defensive: it validates and truncates input,
// rate-limits per IP, drops known noise, samples, and always answers quickly
// with 204 so a misbehaving (or malicious) client cannot use it to flood the
// log index or stall request handling.

import { secretEnv } from '../../envConfig.mjs';
import logger from '../../config/logger.mjs';
import { symbolicate } from './symbolicate.mjs';

// --- Configuration -------------------------------------------------------------

// Server-side sampling, applied on top of any client-side sampling. 0..1.
const SAMPLE_RATE = clampRate(secretEnv.TELEMETRY_SAMPLE_RATE, 1);

// Per-IP sliding window rate limit.
const WINDOW_MS = 60_000;
const MAX_PER_IP_PER_WINDOW = 30;
// Global safety valve across all clients, protects the log index from a storm.
const MAX_GLOBAL_PER_WINDOW = 600;

// Field caps (mirror the client, enforced again here - never trust the client).
const MAX_MESSAGE = 1000;
const MAX_STACK = 8000;
const MAX_URL = 2000;
const MAX_UA = 500;
const MAX_CONTEXT_CHARS = 4000;

const IGNORED_MESSAGES = [
  'ResizeObserver loop limit exceeded',
  'ResizeObserver loop completed with undelivered notifications',
  'Script error.',
  'Script error',
  'This component should not be rendered on the server.',
];

// --- In-memory limiters --------------------------------------------------------
// Single-process counters. Good enough for diagnostics; if the portal is ever run
// multi-process these become per-process (still safe, just less precise).

/** @type {Map<string, number[]>} ip -> recent request timestamps */
const ipHits = new Map();
let globalHits = [];

function withinWindow(timestamps, now) {
  return timestamps.filter((t) => now - t < WINDOW_MS);
}

function rateLimited(ip) {
  const now = Date.now();

  globalHits = withinWindow(globalHits, now);
  if (globalHits.length >= MAX_GLOBAL_PER_WINDOW) return true;

  const hits = withinWindow(ipHits.get(ip) ?? [], now);
  if (hits.length >= MAX_PER_IP_PER_WINDOW) {
    ipHits.set(ip, hits);
    return true;
  }

  hits.push(now);
  ipHits.set(ip, hits);
  globalHits.push(now);

  // Opportunistic cleanup so the Map doesn't grow unbounded.
  if (ipHits.size > 5000) {
    for (const [key, value] of ipHits) {
      const live = withinWindow(value, now);
      if (live.length === 0) ipHits.delete(key);
      else ipHits.set(key, live);
    }
  }

  return false;
}

// --- Helpers -------------------------------------------------------------------

function clampRate(value, fallback) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}

function asString(value, max) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.length > max ? `${value.slice(0, max)}…[truncated]` : value;
  return scrub(trimmed);
}

function asInt(value) {
  return Number.isInteger(value) ? value : undefined;
}

// Light PII scrubbing. Even though data stays on our own infrastructure, there is
// no reason to persist raw emails or long bearer-like tokens in diagnostic logs.
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const TOKEN_RE = /\b(?:bearer\s+)?[A-Za-z0-9_-]{40,}\b/gi;

function scrub(value) {
  return value.replace(EMAIL_RE, '[redacted-email]').replace(TOKEN_RE, '[redacted-token]');
}

function isIgnored(message) {
  return IGNORED_MESSAGES.some((ignored) => message.includes(ignored));
}

// Build the structured log fields from a validated body, symbolicating the stack.
// Kept separate so it runs *after* the response has been sent - symbolication
// reads source maps from disk and should never delay the client.
function logClientError(body, ip) {
  let context;
  if (body.context && typeof body.context === 'object') {
    try {
      const serialised = JSON.stringify(body.context);
      if (serialised && serialised.length <= MAX_CONTEXT_CHARS) {
        context = JSON.parse(scrub(serialised));
      }
    } catch {
      /* ignore malformed context */
    }
  }

  const message = asString(body.message, MAX_MESSAGE);
  const rawStack = asString(body.stack, MAX_STACK);

  // Resolve minified frames to original source. Best-effort: on any miss we keep
  // the raw stack and flag the document so dashboards can tell them apart.
  let stackTrace = rawStack;
  let minifiedStack;
  let symbolicated = 'false';
  let sourceLocation;
  let codeContext;
  if (rawStack) {
    try {
      const mapped = symbolicate(rawStack);
      if (mapped.resolved > 0) {
        stackTrace = asString(mapped.stack, MAX_STACK);
        minifiedStack = rawStack; // keep the original for reference
        symbolicated = mapped.resolved === mapped.total ? 'true' : 'partial';
        sourceLocation = mapped.topFrame;
        codeContext = asString(mapped.snippet, MAX_CONTEXT_CHARS);
      }
    } catch {
      /* fall back to the raw stack */
    }
  }

  // Structured ECS-friendly fields so Kibana dashboards can facet cleanly.
  logger.error(`client error: ${message}`, {
    class: 'client',
    event: { kind: 'client-error', category: 'web', module: 'telemetry' },
    error: {
      type: asString(body.name, 200),
      message,
      stack_trace: stackTrace,
      stack_trace_minified: minifiedStack,
      source_location: sourceLocation,
    },
    code_context: codeContext,
    url: {
      full: asString(body.url, MAX_URL),
      path: asString(body.pathname, MAX_URL),
    },
    http: { request: { referrer: asString(body.referrer, MAX_URL) } },
    user_agent: { original: asString(body.userAgent, MAX_UA) },
    client: { ip },
    labels: {
      telemetry_kind: asString(body.kind, 50) ?? 'manual',
      release: asString(body.release, 100) ?? 'unknown',
      language: asString(body.language, 20),
      symbolicated,
    },
    source: asString(body.source, MAX_URL),
    lineno: asInt(body.lineno),
    colno: asInt(body.colno),
    context,
  });
}

// --- Route ---------------------------------------------------------------------

function handleError(req, res) {
  // Always respond fast and uncacheable. We never block the client on logging,
  // and we intentionally do not reveal whether an event was kept or dropped.
  res.set('Cache-Control', 'no-store');

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).end();
  }
  if (!asString(body.message, MAX_MESSAGE)) {
    return res.status(400).end();
  }

  // Decide whether to keep the event, but respond 204 either way so a client
  // can't tell (and can't be used to probe) what we drop.
  const message = asString(body.message, MAX_MESSAGE);
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const keep =
    !isIgnored(message) &&
    !rateLimited(ip) &&
    !(SAMPLE_RATE < 1 && Math.random() > SAMPLE_RATE);

  res.status(204).end();

  // Symbolicate + log after the response is on its way. Never throw.
  if (keep) {
    try {
      logClientError(body, ip);
    } catch (err) {
      try {
        logger.logError(err instanceof Error ? err : new Error('telemetry ingest failed'), {
          class: 'web',
          event: { kind: 'telemetry-ingest-error' },
        });
      } catch {
        /* last resort: give up silently */
      }
    }
  }
}

export function register(app) {
  app.post('/api/telemetry/error', handleError);
}

export default register;
