// Move client source maps out of the publicly-served build directory.
//
// The Vite client build emits .map files alongside the JS in dist/gbif/client,
// which Express serves statically (app.use(express.static('dist/gbif/client'))).
// Serving .map files publicly would expose our full source, so after the build
// we relocate every map into a private dist/sourcemaps/ directory that only the
// telemetry endpoint reads (to symbolicate client error stacks).
//
// Filenames are content-hashed (e.g. index-abc123.js.map) and therefore unique,
// so we can flatten them into a single directory keyed by basename - which is
// exactly how symbolicate.mjs looks them up.

import fs from 'node:fs';
import path from 'node:path';

const CLIENT_DIR = path.resolve('dist/gbif/client');
const OUT_DIR = path.resolve('dist/sourcemaps');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith('.map')) files.push(full);
  }
  return files;
}

if (!fs.existsSync(CLIENT_DIR)) {
  console.warn(`extract-sourcemaps: ${CLIENT_DIR} not found, nothing to do.`);
  process.exit(0);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const maps = walk(CLIENT_DIR);
for (const map of maps) {
  const dest = path.join(OUT_DIR, path.basename(map));
  fs.renameSync(map, dest);
}

console.log(`extract-sourcemaps: moved ${maps.length} source map(s) to ${OUT_DIR}`);
