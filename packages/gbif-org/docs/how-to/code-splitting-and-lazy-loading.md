# How to code-split and lazy load

Vite splits anything behind a dynamic `import()`. Use it for large or rarely used code.

## A section inside a page

```tsx
import { Suspense, lazy } from 'react';
const MyLazyComponent = lazy(() => import('@/components/MyLazyComponent'));

<Suspense fallback={<p>Loading...</p>}>
  <MyLazyComponent />
</Suspense>
```

Wrap in `ErrorBoundary` (`src/components/ErrorBoundary`) if a failed chunk should not take down
the page.

## A whole page, not server-rendered

`React.lazy` inside `StaticRenderSuspence` (`src/components/staticRenderSuspence.tsx`) fetches the
page chunk only when the route is visited.

```tsx
const OccurrenceSearchPage = React.lazy(() => import('@/routes/occurrence/search/Page'));

export const occurrenceSearchRoute: RouteObjectWithPlugins = {
  id: 'occurrenceSearch',
  path: 'occurrence/search',
  loader: occurrenceSearchLoader,
  loadingElement: <OccurrenceSearchPageSkeleton />,
  element: (
    <StaticRenderSuspence fallback={<OccurrenceSearchPageSkeleton />}>
      <OccurrenceSearchPage />
    </StaticRenderSuspence>
  ),
};
```

Keep the lazy `element` in a different file from `loader` and `loadingElement`, so the loader can
fetch while the chunk downloads.

**Caveat: this disables SSR for the page.** `renderToString` cannot suspend, so the server renders
the fallback and content appears after hydration. Fine for tools and tabs. Not for pages where
server-rendered content matters for SEO or first paint (dataset, species, occurrence detail).

## A whole page, keeping SSR

The default for every page and tab. Every route module is imported by the route tables, so anything
a route's `element` imports statically ships on every page.

Use react-router's route-level `lazy` through `lazyElement` (`src/reactRouterPlugins/lazyElement.tsx`).
The server resolves it before rendering (`createStaticHandler`, `src/gbif/entry.server.tsx`); the
client pre-resolves in `loadLazyRoutes` before `hydrateRoot` (`src/gbif/entry.client.tsx`).

```tsx
import { lazyElement, lazyLoader } from '@/reactRouterPlugins';
import { datasetLoader } from './datasetKey.loader';

{
  id: 'datasetKey',
  path: 'dataset/:key',
  loader: datasetLoader,
  lazy: lazyElement(() => import('./datasetKey'), 'DatasetPage'),
  children: [
    // Optional third argument wraps the element, e.g. in an ErrorBoundary or ProtectedRoute.
    { index: true, lazy: lazyElement(() => import('./about'), 'DatasetKeyAbout') },
    {
      path: 'event/:eventID',
      lazy: lazyElement(() => import('./event/eventID'), 'DatasetEventID'),
      loader: lazyLoader(() => import('./event/eventID'), 'eventLoader'),
    },
  ],
}
```

- **`loader` stays on the route object.** The plugins wrap it to inject `config`, `locale`,
  `graphql`, `isPreview`; a loader returned from `lazy()` bypasses that.
- **Entry pages get a loader module** (`datasetKey.loader.ts`) that does not import the page, so the
  query starts while the chunk downloads. `lazyLoader` is for loaders still living in a page
  module: the query waits for the chunk on the first client-side visit.
- **Import nothing else from the page module** in the route file, or the module is eager again.
  Types with `import type`; skeletons from `ArticleSkeleton` or another light module.
- **Fragments are registered on import** (`fragmentManager.register`). A loader whose query spreads
  a fragment from a tab or component must import that module itself (side-effect import). Nothing
  else loads it first any more; the symptom is "Fragment X has not been registered".

`node scripts/eager-graph.mjs <module>` prints what the initial bundle contains and the import
chain that pulls a module in.
