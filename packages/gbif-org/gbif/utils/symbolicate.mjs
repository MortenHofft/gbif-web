// Resolve minified stack traces back to original source using source maps.
//
// Handles two frame styles:
//   Server bundles: "at Fn (file:///srv/app/dist/gbif/server/entry.server.js:5557:28)"
//                   → reads <absPath>.map from beside the .js file
//   Client bundles: "at fn (https://cdn.example.com/assets/index-abc123.js:1:2345)"
//                   → reads SOURCEMAP_DIR/<basename>.map (populated by extract-sourcemaps.mjs)
//
// Uses @jridgewell/trace-mapping (same mapper Vite/Rollup use) with a small LRU
// cache: map parsing happens once per chunk per process. Everything is best-effort;
// any failure falls back to the raw stack so an error is never lost to symbolication.

import fs from 'node:fs';
import path from 'node:path';
import { TraceMap, originalPositionFor, sourceContentFor } from '@jridgewell/trace-mapping';

// Where client .map files live after extract-sourcemaps.mjs moves them.
// Override with SOURCEMAP_DIR env var if the maps are stored elsewhere.
const SOURCEMAP_DIR =
  process.env.SOURCEMAP_DIR || path.join(process.cwd(), 'dist', 'sourcemaps');

const CACHE_MAX = 50;
// fileRef string → TraceMap | null (null = known-missing, avoids repeated disk hits)
const cache = new Map();

// Matches "<file>.js:<line>:<col>" inside a stack frame. The character class
// excludes spaces, parens, quotes and @ so it works across Chrome, Firefox, and
// Node.js stack formats.
const FRAME_RE = /([^\s():'"@]+\.js):(\d+):(\d+)/;
const MAX_FRAMES = 40;
const SNIPPET_RADIUS = 3; // lines of context on each side of the error line

function resolveMapPath(fileRef) {
  const clean = fileRef.split('?')[0]; // strip query strings (?v=xxx, ?t=xxx)

  // file:// URL — Node.js server bundle frames use this format.
  if (clean.startsWith('file://')) {
    try {
      const absPath = new URL(clean).pathname;
      const mapPath = `${absPath}.map`;
      if (fs.existsSync(mapPath)) return mapPath;
    } catch {
      // malformed URL; fall through
    }
    // Don't try the basename fallback for file:// frames — a miss here means the
    // map was not emitted for this build, not that we should look in the client dir.
    return null;
  }

  // Absolute filesystem path (some Node.js stacks omit the file:// scheme).
  if (path.isAbsolute(clean)) {
    const mapPath = `${clean}.map`;
    if (fs.existsSync(mapPath)) return mapPath;
    return null;
  }

  // URL or bare basename → client bundle. Use path.basename to strip any directory
  // component in the URL (e.g. /assets/index-abc.js → index-abc.js) which also
  // prevents path traversal when this is called with user-supplied stack strings.
  const basename = path.basename(clean);
  if (basename) {
    const mapPath = path.join(SOURCEMAP_DIR, `${basename}.map`);
    if (fs.existsSync(mapPath)) return mapPath;
  }

  return null;
}

function getTraceMap(fileRef) {
  if (cache.has(fileRef)) {
    // Bump to the back (LRU recency) without a separate list structure.
    const cached = cache.get(fileRef);
    cache.delete(fileRef);
    cache.set(fileRef, cached);
    return cached;
  }

  let traceMap = null;
  try {
    const mapPath = resolveMapPath(fileRef);
    if (mapPath) traceMap = new TraceMap(fs.readFileSync(mapPath, 'utf8'));
  } catch {
    traceMap = null; // cache the miss so repeated frames don't keep hitting disk
  }

  cache.set(fileRef, traceMap);
  if (cache.size > CACHE_MAX) {
    cache.delete(cache.keys().next().value);
  }
  return traceMap;
}

function cleanSource(source) {
  // Source map entries often have "../../src/..." relative paths; trim to repo-relative.
  return source.replace(/^(\.\.\/)+/, '').replace(/^\/+/, '');
}

function buildSnippet(traceMap, pos) {
  try {
    const content = sourceContentFor(traceMap, pos.source);
    if (!content || !pos.line) return undefined;
    const lines = content.split('\n');
    const start = Math.max(0, pos.line - 1 - SNIPPET_RADIUS);
    const end = Math.min(lines.length, pos.line + SNIPPET_RADIUS);
    return lines
      .slice(start, end)
      .map((text, i) => {
        const lineNo = start + i + 1;
        const marker = lineNo === pos.line ? '>' : ' ';
        return `${marker} ${lineNo} | ${text}`;
      })
      .join('\n');
  } catch {
    return undefined;
  }
}

/**
 * Resolve a minified stack trace to original source positions using source maps.
 *
 * Works for server-side bundles (file:// URLs / absolute paths) and client-side
 * minified bundles (basenames looked up in SOURCEMAP_DIR). Best-effort: returns
 * the raw stack unchanged if no maps are found.
 *
 * @param {string} stack  Raw stack trace string.
 * @returns {{
 *   stack: string,        Symbolicated stack (or raw stack on total miss).
 *   resolved: number,     Number of frames successfully mapped.
 *   total: number,        Number of frames that had a .js reference.
 *   topFrame?: {source: string, line: number, column: number, name?: string},
 *   snippet?: string,     Source code lines around the top frame.
 * }}
 */
export function symbolicate(stack) {
  const result = { stack, resolved: 0, total: 0 };
  if (typeof stack !== 'string' || !stack) return result;

  const lines = stack.split('\n');
  const out = [];

  for (const line of lines) {
    const match = line.match(FRAME_RE);
    if (!match || result.total >= MAX_FRAMES) {
      out.push(line);
      continue;
    }

    result.total += 1;
    const [, fileRef, lineStr, colStr] = match;
    const traceMap = getTraceMap(fileRef);
    if (!traceMap) {
      out.push(line);
      continue;
    }

    const pos = originalPositionFor(traceMap, {
      line: Number(lineStr),
      // Browser/Node stacks report 1-based columns; source maps are 0-based.
      column: Math.max(0, Number(colStr) - 1),
    });
    if (!pos || !pos.source || pos.line == null) {
      out.push(line);
      continue;
    }

    result.resolved += 1;
    const source = cleanSource(pos.source);
    const loc = `${source}:${pos.line}:${pos.column ?? 0}`;
    const name = pos.name ? `${pos.name} ` : '';
    // Replace the minified "file:line:col" segment with the resolved location,
    // keeping surrounding "at ..." text from the original frame.
    out.push(line.replace(FRAME_RE, `${name}(${loc})`).trimEnd());

    if (!result.topFrame) {
      result.topFrame = { source, line: pos.line, column: pos.column ?? 0, name: pos.name };
      result.snippet = buildSnippet(traceMap, pos);
    }
  }

  result.stack = out.join('\n');
  return result;
}

export default symbolicate;
