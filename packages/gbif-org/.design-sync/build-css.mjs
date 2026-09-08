/**
 * Builds the single stylesheet the design system ships (`cfg.cssEntry`).
 *
 * Two sources, both the repo's own:
 *
 *  1. Tailwind, compiled through `.design-sync/tailwind.ds.cjs` — the app's real
 *     `tailwind.config.js` plus a safelist (see that file: the app compiles only
 *     the classes its own source uses, which leaves most of the themed palette
 *     missing for anyone composing new screens). Same `g-` prefix, same disabled
 *     preflight, same typography/animate plugins. The map engine stylesheets
 *     (`ol`, `maplibre-gl`) are dropped: map components are out of the synced
 *     scope and they add ~200KB of unrelated CSS.
 *
 *  2. The runtime theme, evaluated by calling the app's own `createTheme()`
 *     from `src/config/theme` and serialised with the same hex→"r g b"
 *     conversion `ConfigProvider` uses. These are the `--primary500`,
 *     `--fontFamily`, `--borderRadiusPx`, `--linkColor` … variables that
 *     `tailwind.config.js` resolves its colours against; without them every
 *     themed utility computes to an invalid colour.
 *
 * Order is load-bearing: the theme block is appended LAST. `index.css` defines
 * shadcn defaults for some of the same names (e.g. `--background: hsl(...)`)
 * inside `@layer base`, and the tailwind config reads them as `rgb(var(--background))`
 * — only the runtime theme's "241 245 248" triples make that valid. In the app
 * the same override happens because ConfigProvider injects its `<style>` after
 * the stylesheet.
 */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const TMP = join(HERE, '.cache');
mkdirSync(TMP, { recursive: true });

/**
 * The `PUBLIC_*` half of the repo's `.env`, which is what `import.meta.env`
 * resolves to under vite. Only `PUBLIC_*` is passed through — the rest of
 * `.env` holds credentials that have no business in a build artifact, and the
 * theme depends on none of them. Falls back to `.env.example` so the sync also
 * works on a clone that has no local `.env`.
 */
function publicEnv() {
  const out = {};
  for (const f of ['.env', '.env.example']) {
    let raw;
    try {
      raw = readFileSync(join(PKG, f), 'utf8');
    } catch {
      continue;
    }
    for (const line of raw.split('\n')) {
      const m = /^\s*(PUBLIC_[A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (m && out[m[1]] === undefined) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
    if (Object.keys(out).length) break;
  }
  return out;
}

// ── 1. Tailwind ──────────────────────────────────────────────────────────────
const indexCss = readFileSync(join(PKG, 'src/index.css'), 'utf8');
const twSrc = indexCss
  .split('\n')
  .filter((l) => !/^@import\s+'(ol\/|maplibre-gl\/)/.test(l.trim()))
  .join('\n');
const twSrcPath = join(TMP, 'tw-src.css');
writeFileSync(twSrcPath, twSrc);

const twOut = join(TMP, 'tailwind.css');
console.error('[css] compiling tailwind …');
execFileSync(
  join(PKG, 'node_modules/.bin/tailwindcss'),
  ['-c', join(HERE, 'tailwind.ds.cjs'), '-i', twSrcPath, '-o', twOut, '--minify=false'],
  { cwd: PKG, stdio: ['ignore', 'ignore', 'inherit'] },
);

// ── 2. Theme variables, from the app's own theme builder ─────────────────────
console.error('[css] evaluating theme …');
const themeBundle = join(TMP, 'theme.mjs');
await build({
  entryPoints: [join(PKG, 'src/config/theme/index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: themeBundle,
  logLevel: 'warning',
});
const { default: createTheme } = await import(themeBundle + `?v=${Date.now()}`);

// The live gbif.org theme override (green #4C9C2E, Helvetica Neue, GBIF chart
// and IUCN palettes). Read from src/gbif/config.ts rather than transcribed, so
// a brand change in the app reaches the design system on the next sync.
// `import.meta.env` is stubbed: the file reads env vars for API endpoints,
// none of which the theme depends on.
const cfgBundle = join(TMP, 'gbif-config.mjs');
await build({
  entryPoints: [join(PKG, 'src/gbif/config.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: cfgBundle,
  tsconfig: join(PKG, 'tsconfig.json'),
  define: { 'import.meta.env': JSON.stringify(publicEnv()) },
  logLevel: 'warning',
});
const { gbifConfig } = await import(cfgBundle + `?v=${Date.now()}`);
if (!gbifConfig?.theme?.primary) throw new Error('gbifConfig.theme.primary missing — theme wiring broke');
console.error(`[css] site theme: primary=${gbifConfig.theme.primary} link=${gbifConfig.theme.linkColor}`);

// Serialise the real site config so the preview provider can hand it to the
// app's own ConfigProvider. It cannot be imported into the browser bundle
// directly: `src/gbif/config.ts` and `src/config/languagesOptions.tsx` read
// `import.meta.env`, which esbuild leaves empty in an IIFE, and
// `PUBLIC_ENABLED_LANGUAGES.split(',')` then throws at load time. Evaluating it
// here in node — where the env IS available — and emitting JSON gives the real
// config with the real language list, regenerated on every sync.
const GEN = join(HERE, 'generated');
mkdirSync(GEN, { recursive: true });
const dropped = [];
const configJson = JSON.stringify(
  gbifConfig,
  function (k, v) {
    if (typeof v === 'function') { dropped.push(k); return undefined; }
    return v;
  },
  2,
);
writeFileSync(join(GEN, 'gbif-config.json'), configJson + '\n');
console.error(
  `[config] wrote generated/gbif-config.json (${Math.round(configJson.length / 1024)}KB, ` +
  `${gbifConfig.languages?.length ?? 0} language(s))` +
  (dropped.length ? ` — dropped non-serialisable key(s): ${[...new Set(dropped)].join(', ')}` : ''),
);

// Mirrors ConfigProvider in src/config/config.tsx — hex colours become bare
// "r g b" triples so tailwind can apply `<alpha-value>`; nulls are dropped.
function themeToVars(theme) {
  return Object.entries(theme)
    .filter(([, value]) => value != null)
    .map(([key, value]) => {
      if (typeof value === 'string' && value.startsWith('#')) {
        const rgb = value.match(/[A-Za-z0-9]{2}/g)?.map((v) => parseInt(v, 16));
        if (rgb?.length === 3) return `  --${key}: ${rgb.join(' ')};`;
      }
      return `  --${key}: ${value};`;
    })
    .join('\n');
}

const light = createTheme({ baseTheme: 'light', extendWith: gbifConfig.theme });
const dark = createTheme({ baseTheme: 'dark', extendWith: gbifConfig.theme });

const themeCss = [
  '/* GBIF runtime theme — generated by .design-sync/build-css.mjs from',
  '   src/config/theme (the same createTheme() ConfigProvider calls). */',
  ':root {',
  themeToVars(light),
  '}',
  '',
  '.dark {',
  themeToVars(dark),
  '}',
  '',
].join('\n');

// ── 3. Emit ──────────────────────────────────────────────────────────────────
const out = join(HERE, 'compiled.css');
writeFileSync(out, readFileSync(twOut, 'utf8') + '\n' + themeCss);
rmSync(themeBundle, { force: true });

const kb = (p) => Math.round(readFileSync(p).length / 1024);
console.error(`[css] tailwind ${kb(twOut)}KB + theme ${Math.round(themeCss.length / 1024)}KB → compiled.css ${kb(out)}KB`);
console.error(`[css] light theme vars: ${Object.keys(light).length}`);
