/** Diagnostic: shortest import chain from the barrel to each heavy dependency. */
import { build } from 'esbuild';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');

const r = await build({
  entryPoints: [join(HERE, 'entry.tsx')],
  bundle: true,
  write: false,
  outdir: '/private/tmp/claude-501/-Users-ksb861-Documents-dev-git-morten-web-packages-gbif-org/7af03006-054d-4312-b5ea-27593ee250d3/scratchpad/why-out',
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  tsconfig: join(HERE, 'tsconfig.json'),
  metafile: true,
  logLevel: 'silent',
  loader: { '.svg': 'dataurl', '.png': 'dataurl', '.woff': 'dataurl', '.woff2': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': '{}' },
});

const inputs = r.metafile.inputs;
const entry = Object.keys(inputs).find((k) => k.endsWith('.design-sync/entry.tsx'));

// BFS over the import graph, remembering how we first reached each module.
const prev = new Map([[entry, null]]);
const q = [entry];
while (q.length) {
  const cur = q.shift();
  for (const imp of inputs[cur]?.imports ?? []) {
    if (!inputs[imp.path] || prev.has(imp.path)) continue;
    prev.set(imp.path, cur);
    q.push(imp.path);
  }
}

const chain = (p) => {
  const out = [];
  for (let c = p; c; c = prev.get(c)) out.unshift(c.replace('node_modules/', 'nm:'));
  return out;
};

const HEAVY = ['highcharts', 'mapbox-gl', 'maplibre-gl', 'd3-', 'phylotree', 'node_modules/ol/', 'proj4', '@biowasm', 'react-icons'];
const bytesBy = {};
for (const [p, meta] of Object.entries(inputs)) {
  for (const h of HEAVY) if (p.includes(h)) bytesBy[h] = (bytesBy[h] ?? 0) + meta.bytes;
}

for (const h of HEAVY) {
  const hit = [...prev.keys()].find((p) => p.includes(h));
  const kb = Math.round((bytesBy[h] ?? 0) / 1024);
  if (!hit) { console.log(`\n${h}: not reachable`); continue; }
  console.log(`\n${h}  (${kb} KB total)`);
  for (const step of chain(hit).slice(0, 12)) console.log(`   ${step}`);
}

const total = Object.values(inputs).reduce((a, m) => a + m.bytes, 0);
console.log(`\nTOTAL input bytes: ${Math.round(total / 1024)} KB across ${Object.keys(inputs).length} modules`);
