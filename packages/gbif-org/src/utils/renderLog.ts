// TEMPORARY render instrumentation for debugging re-renders.
// Records render counts on a window global so they can be snapshotted
// precisely from automation (e.g. Playwright) and also logs to console.
// Remove this file and its usages when done.
export function renderLog(name: string) {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __renderCounts?: Record<string, number> };
  w.__renderCounts = w.__renderCounts || {};
  w.__renderCounts[name] = (w.__renderCounts[name] || 0) + 1;
  // eslint-disable-next-line no-console
  console.log(`[render] ${name} #${w.__renderCounts[name]}`);
}
