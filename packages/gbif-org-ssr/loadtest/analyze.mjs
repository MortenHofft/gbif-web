// Summarise a V8 .cpuprofile from a load run: CPU by category + top self-time frames.
//   node loadtest/analyze.mjs loadtest/profiles/<file>.cpuprofile [skipMs=3000]
import fs from 'node:fs';

const prof = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const skipMs = Number(process.argv[3] || 3000); // drop boot + cold first renders
const { nodes, samples, timeDeltas, startTime, endTime } = prof;

const byId = new Map(nodes.map((n) => [n.id, n]));

let cum = 0;
const self = new Map();
let total = 0,
  idle = 0;
for (let i = 0; i < samples.length; i++) {
  cum += timeDeltas[i] || 0;
  if (cum < skipMs * 1000) continue; // warmup window
  const id = samples[i];
  self.set(id, (self.get(id) || 0) + (timeDeltas[i] || 0));
  total += timeDeltas[i] || 0;
  const n = byId.get(id);
  if (n && n.callFrame.functionName === '(idle)') idle += timeDeltas[i] || 0;
}
const active = total - idle;
const ms = (n) => (n / 1000).toFixed(0) + 'ms';
const pA = (n) => ((n / active) * 100).toFixed(1) + '%';
const short = (u) =>
  !u
    ? '(native)'
    : u.startsWith('node:')
      ? u
      : u.replace(/^file:\/\//, '').replace(/.*\/node_modules\//, 'nm:').replace(/.*\/gbif-org-ssr\//, '');

const byFn = new Map();
for (const [id, t] of self) {
  const n = byId.get(id);
  if (!n) continue;
  const cf = n.callFrame;
  const k = `${cf.functionName}__${cf.url}:${cf.lineNumber}`;
  const cur = byFn.get(k) || { self: 0, fn: cf.functionName, url: cf.url, line: cf.lineNumber };
  cur.self += t;
  byFn.set(k, cur);
}

const cats = {};
const add = (k, t) => (cats[k] = (cats[k] || 0) + t);
for (const v of byFn.values()) {
  const u = v.url || '',
    fn = v.fn || '';
  if (fn === '(idle)') continue;
  if (fn === '(garbage collector)') add('GC', v.self);
  else if (fn === '(program)') add('(program) v8/native dispatch', v.self);
  else if (/preact-render-to-string/.test(u)) add('preact-render-to-string', v.self);
  else if (/\/preact\//.test(u)) add('preact core', v.self);
  else if (/JSON/.test(fn)) add('JSON.parse/stringify', v.self);
  else if (/undici|fetch/i.test(u)) add('undici / fetch (upstream)', v.self);
  else if (/\/express\/|\/router\/|path-to-regexp/.test(u)) add('express + routing', v.self);
  else if (/gbif-org-ssr\/(src|dist)/.test(u)) add('APP code', v.self);
  else if (/node_modules/.test(u)) add('other node_modules', v.self);
  else if (!u || u.startsWith('node:')) add('node builtins / native', v.self);
  else add('uncategorised', v.self);
}

console.log(`=== STEADY-STATE (skipped first ${skipMs}ms) ===`);
console.log('wall captured  :', ms(endTime - startTime));
console.log('window         :', ms(total), `(active ${ms(active)}, idle ${ms(idle)})`);
console.log('CPU utilisation:', ((active / total) * 100).toFixed(1) + '% busy');

console.log('\n=== CPU BY CATEGORY (% of active CPU) ===');
for (const [k, t] of Object.entries(cats).sort((a, b) => b[1] - a[1]))
  console.log(`${pA(t).padStart(7)} ${ms(t).padStart(8)}  ${k}`);

console.log('\n=== TOP 30 FUNCTIONS BY SELF TIME ===');
for (const v of [...byFn.values()].filter((v) => v.fn !== '(idle)').sort((a, b) => b.self - a.self).slice(0, 30))
  console.log(
    `${pA(v.self).padStart(7)} ${ms(v.self).padStart(8)}  ${(v.fn || '(anonymous)').slice(0, 38).padEnd(38)} ${short(v.url)}:${v.line + 1}`
  );
