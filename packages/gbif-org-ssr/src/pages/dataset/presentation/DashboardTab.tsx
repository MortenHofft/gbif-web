import type { DatasetView } from '../transform';

// The dashboard SHELL is server-rendered (instant paint). The charts are interactive
// (click a bar to drill down), so they run client-side as a Preact island that fetches
// from the GraphQL API in the browser. We only render the mount point + a fallback here.
export function DashboardTab({ view }: { view: DatasetView }) {
  return (
    <div class="space-y-6">
      <div>
        <h2 class="text-lg font-semibold">Occurrences over time</h2>
        <p class="text-sm text-gray-600">
          Live from the GBIF API. Click a bar to open that year in occurrence search.
        </p>
      </div>

      {/* Island placeholder: matched by data-island="dashboard-charts". */}
      <div
        data-island="dashboard-charts"
        class="min-h-[16rem] rounded-lg border bg-white p-4"
      >
        {/* Server-rendered fallback shown until the island mounts (and for no-JS). */}
        <div class="flex h-56 items-center justify-center text-sm text-gray-400">
          Loading chart…
        </div>
      </div>

      <noscript>
        <p class="text-sm text-gray-500">
          The interactive dashboard requires JavaScript. The dataset summary above does not.
        </p>
      </noscript>
    </div>
  );
}

// Props passed to the client island (kept minimal and serializable).
export function dashboardIslandProps(view: DatasetView) {
  return { datasetKey: view.key };
}
