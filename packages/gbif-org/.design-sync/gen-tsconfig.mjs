/**
 * Generates `.design-sync/tsconfig.json` — the tsconfig the converter's
 * esbuild path plugin reads.
 *
 * Two things it has to do that the package tsconfig doesn't:
 *
 * 1. **Spell out directory imports.** The converter resolves `@/x` by testing
 *    `src/x`, `src/x.ts`, `src/x.tsx`, … in order and accepting the first path
 *    that exists — and a *directory* exists, so `@/config/fallback` resolves to
 *    the folder and esbuild fails with "is a directory". The package tsconfig
 *    never hits this because esbuild's own resolver understands directories.
 *    So every `@/…` specifier in the repo that names a directory gets an exact
 *    rule pointing at its real index file. Exact rules are matched before the
 *    `@/*` wildcard, so this is purely additive.
 *
 * 2. **Apply the barrel shim repo-wide.** `@/reactRouterPlugins` is remapped for
 *    every importer, including files inside `src/` — esbuild's own tsconfig
 *    discovery would apply it only to files under `.design-sync/`.
 *
 * Regenerate whenever imports change; it is cheap and deterministic.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const SRC = join(PKG, 'src');

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = [...walk(SRC), ...walk(join(HERE, 'shims')), join(HERE, 'entry.tsx'), join(HERE, 'provider.tsx')];

const specs = new Set();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/from\s+'(@\/[^']+)'|import\(\s*'(@\/[^']+)'/g)) {
    specs.add(m[1] ?? m[2]);
  }
}

// Specifiers the shims own — they must not be re-pinned to their real index
// below, which (being a later key in the same object) would silently win.
const SHIMMED = {
  '@/reactRouterPlugins': ['.design-sync/shims/reactRouterPlugins.ts'],
  '@/config/fallback': ['.design-sync/shims/configFallback.ts'],
};

const INDEX_EXTS = ['index.ts', 'index.tsx', 'index.js', 'index.jsx'];
const dirRules = {};
for (const spec of [...specs].sort()) {
  if (spec in SHIMMED) continue;
  const target = join(SRC, spec.slice('@/'.length));
  if (!existsSync(target) || !statSync(target).isDirectory()) continue;
  const idx = INDEX_EXTS.map((e) => join(target, e)).find(existsSync);
  if (!idx) {
    console.error(`  ! ${spec} is a directory with no index file — left to the wildcard`);
    continue;
  }
  dirRules[spec] = ['./' + relative(PKG, idx)];
}

const tsconfig = {
  extends: '../tsconfig.json',
  compilerOptions: {
    baseUrl: '..',
    paths: {
      // Shims first: an exact rule always beats the `@/*` wildcard below.
      ...SHIMMED,
      ...dirRules,
      '@/*': ['./src/*'],
    },
  },
};

writeFileSync(join(HERE, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2) + '\n');
console.error(`[tsconfig] ${Object.keys(dirRules).length} directory import(s) pinned to their index file`);
for (const k of Object.keys(dirRules)) console.error(`             ${k}`);
