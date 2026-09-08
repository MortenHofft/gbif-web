/**
 * Rewrites `@/…` specifiers in the emitted declaration tree to relative paths.
 *
 * `tsc --emitDeclarationOnly` preserves import specifiers verbatim, so every
 * emitted `.d.ts` still says `from '@/components/properties'`. The converter's
 * prop extractor builds its own ts-morph Project with no `baseUrl`/`paths`, so
 * those specifiers dangle: the re-export chain from the types entry never
 * resolves, `getExportedDeclarations()` comes back empty, and every component
 * without an explicit `<Name>Props` interface emits `[key: string]: unknown`
 * instead of its real API.
 *
 * Rewriting them to paths relative to each file's own location makes the tree
 * self-contained and resolvable by any consumer.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const TYPES = join(PKG, 'dist/types');
const SRC_TYPES = join(TYPES, 'src');

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const files = walk(TYPES);
let changed = 0;
let rewrites = 0;

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const out = src.replace(/(['"])@\/([^'"]+)\1/g, (_m, q, tail) => {
    let rel = relative(dirname(f), join(SRC_TYPES, tail)).split('\\').join('/');
    if (!rel.startsWith('.')) rel = './' + rel;
    rewrites++;
    return `${q}${rel}${q}`;
  });
  if (out !== src) {
    writeFileSync(f, out);
    changed++;
  }
}

console.error(`[dts-paths] rewrote ${rewrites} '@/…' specifier(s) across ${changed}/${files.length} declaration file(s)`);
if (!files.length) console.error('[dts-paths] ! no declaration files found — run tsc -p .design-sync/tsconfig.declarations.json first');
