/**
 * What ships in every gbif.org page's initial JS, and why.
 *
 * Builds the client (in memory, unminified), walks static imports from gbif/index.html and prints
 * the eager graph's largest packages and folders. For each argument it prints the shortest static
 * import chain that pulls a matching module in, which is the edge to cut (usually by making a route
 * `lazy`, see docs/how-to/code-splitting-and-lazy-loading.md).
 *
 *   node scripts/eager-graph.mjs highcharts/highcharts.js routes/dataset/key/about
 *
 * Sizes are transformed source before tree-shaking; compare runs, not absolute numbers.
 */
import { build } from 'vite';

const patterns = process.argv.slice(2);
const top = Number(process.env.TOP ?? 30);

const report = {
  name: 'eager-graph-report',
  generateBundle() {
    const entries = [...this.getModuleIds()].filter(
      (id) => this.getModuleInfo(id)?.isEntry && id.endsWith('index.html')
    );
    // Breadth-first, so each module's recorded importer gives the shortest chain.
    const importer = new Map(entries.map((id) => [id, null]));
    const queue = [...entries];
    while (queue.length) {
      const id = queue.shift();
      for (const dep of this.getModuleInfo(id)?.importedIds ?? []) {
        if (importer.has(dep)) continue;
        importer.set(dep, id);
        queue.push(dep);
      }
    }

    const sizes = {};
    let total = 0;
    for (const id of importer.keys()) {
      const size = this.getModuleInfo(id)?.code?.length ?? 0;
      const group =
        id.match(/node_modules\/((@[^/]+\/)?[^/]+)/)?.[1] ?? id.match(/src\/([^/]+\/[^/]+)/)?.[1];
      total += size;
      if (group) sizes[group] = (sizes[group] ?? 0) + size;
    }
    console.log(`eager: ${importer.size} modules, ${Math.round(total / 1024)} KB`);
    Object.entries(sizes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, top)
      .forEach(([group, size]) =>
        console.log(`${String(Math.round(size / 1024)).padStart(7)} KB  ${group}`)
      );

    for (const pattern of patterns) {
      const hit = [...importer.keys()].find((id) => id.includes(pattern));
      if (!hit) {
        console.log(`\n${pattern}: not eager`);
        continue;
      }
      const chain = [];
      for (let id = hit; id; id = importer.get(id))
        chain.unshift(id.replace(/.*?\/(src|node_modules)\//, '$1/'));
      console.log(`\n${pattern}:\n  ${chain.join('\n  -> ')}`);
    }
  },
};

await build({
  configFile: 'gbif/vite.config.ts',
  logLevel: 'error',
  plugins: [report],
  build: {
    write: false,
    minify: false,
    sourcemap: false,
    ssrManifest: false,
    rollupOptions: { input: { main: 'gbif/index.html' } },
  },
});
