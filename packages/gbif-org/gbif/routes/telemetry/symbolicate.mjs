// Resolve minified client error stacks back to original source using the build's
// source maps (moved to a private dir by scripts/extract-sourcemaps.mjs).
//
// Uses @jridgewell/trace-mapping (pure JS, the same mapper Vite/Rollup use) and
// caches one parsed map per chunk in a small LRU - parsing is the only real cost
// and it happens once per chunk per process. Everything is best-effort: any
// failure falls back to the raw stack so an error is never lost to symbolication.

import fs from 'node:fs';
import path from 'node:path';
import { TraceMap, originalPositionFor, sourceContentFor } from '@jridgewell/trace-mapping';

// Where extract-sourcemaps.mjs put the maps. Server runs with cwd = package root.
const SOURCEMAP_DIR =
  process.env.SOURCEMAP_DIR || path.join(process.cwd(), 'dist', 'sourcemaps');

const CACHE_MAX = 50;
// basename (e.g. "index-abc123.js") -> TraceMap | null (null = known-missing)
const cache = new Map();

// Matches "<file>.js:<line>:<col>" inside a stack frame, where <file> may be a
// URL or a path. Excludes spaces, parens, quotes and @ so it works across
// Chrome ("at fn (url:1:2)") and Firefox ("fn@url:1:2") formats.
const FRAME_RE = /([^\s():'"@]+\.js):(\d+):(\d+)/;
const MAX_FRAMES = 40;
const SNIPPET_RADIUS = 3; // lines of context on each side of the top frame

function getTraceMap(basename) {
  if (cache.has(basename)) {
    // bump LRU recency
    const cached = cache.get(basename);
    cache.delete(basename);
    cache.set(basename, cached);
    return cached;
  }

  let traceMap = null;
  try {
    // basename is derived from a client-supplied URL - make sure it can't escape
    // the sourcemap dir via path traversal.
    if (path.basename(basename) !== basename) throw new Error('invalid map name');
    const file = path.join(SOURCEMAP_DIR, `${basename}.map`);
    traceMap = new TraceMap(fs.readFileSync(file, 'utf8'));
  } catch {
    traceMap = null; // cache the miss so we don't hit disk repeatedly
  }

  cache.set(basename, traceMap);
  if (cache.size > CACHE_MAX) {
    cache.delete(cache.keys().next().value);
  }
  return traceMap;
}

function cleanSource(source) {
  // Maps record sources like "../../src/routes/foo.tsx" - trim to repo-relative.
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
 * Symbolicate a raw browser stack trace.
 *
 * @param {string} stack
 * @returns {{ stack: string, resolved: number, total: number, topFrame?: object, snippet?: string }}
 */
export function symbolicate(stack) {
  const result = { stack, resolved: 0, total: 0 };
  if (typeof stack !== 'string' || stack.length === 0) return result;

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
    const basename = path.basename(fileRef.split('?')[0]);
    const traceMap = getTraceMap(basename);
    if (!traceMap) {
      out.push(line);
      continue;
    }

    const pos = originalPositionFor(traceMap, {
      // Browser stacks report 1-based columns; source maps are 0-based.
      line: Number(lineStr),
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
    // Replace the minified "file:line:col" with the resolved location, keeping
    // any surrounding "at ..." text from the original frame.
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
