// Bundles each client island entry into public/islands/<name>.js with esbuild.
// Add an entry here when you create a new island. Pass --watch for dev.
import esbuild from 'esbuild';

const isProduction = process.env.NODE_ENV === 'production';
const watch = process.argv.includes('--watch');

const ISLANDS = [{ name: 'dashboard-charts', entry: 'src/islands/dashboard-charts/entry.tsx' }];

const options = {
  entryPoints: ISLANDS.map((i) => ({ in: i.entry, out: i.name })),
  outdir: 'public/islands',
  bundle: true,
  format: 'esm',
  splitting: false,
  target: ['es2020'],
  jsx: 'automatic',
  jsxImportSource: 'preact',
  minify: isProduction,
  sourcemap: !isProduction,
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('[islands] watching…');
} else {
  await esbuild.build(options);
  console.log('[islands] built');
}
