// Bundles the Express app (TS + Preact JSX) into a single plain-JS module so the
// Vercel serverless function (api/index.js) can import it without relying on
// Vercel's own TS/JSX handling. Local dev/start use tsx directly and skip this.
import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/app.ts'],
  outfile: 'dist/server.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: ['node20'],
  jsx: 'automatic',
  jsxImportSource: 'preact',
  // Keep node built-ins external; bundle everything else (preact, express, …).
  packages: 'external',
  minify: process.env.NODE_ENV === 'production',
  sourcemap: false,
  logLevel: 'info',
});
console.log('[server] bundled → dist/server.mjs');
