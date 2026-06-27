// Long-running entry for load testing / profiling. Imports the BUILT app bundle
// (dist/server.mjs — run `npm run build` first) so the CPU profile has no tsx/loader
// frames. Run under the V8 profiler:
//
//   node --cpu-prof --cpu-prof-dir loadtest/profiles loadtest/profile-server.mjs
//
// The profiler only flushes its .cpuprofile on a CLEAN exit, so SIGINT/SIGTERM are
// turned into process.exit(0).
import app from '../dist/server.mjs';

const PORT = parseInt(process.env.PORT || '3100', 10);
app.listen(PORT, () => console.log(`[profile] gbif-org-ssr on http://localhost:${PORT}`));

function shutdown() {
  process.exit(0); // clean exit → --cpu-prof writes the profile
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
