import { ArticleSkeleton } from '@/routes/resource/key/components/articleSkeleton';
import {
  lazyElement,
  lazyLoader,
  RouteObjectWithPlugins,
  useRenderedRouteLoaderData,
} from '@/reactRouterPlugins';
import type { OccurrenceKeyLoaderResult } from './occurrenceKey';

const id = 'occurrenceKey';

export const occurrenceKeyRoutes: RouteObjectWithPlugins[] = [
  {
    id,
    path: 'occurrence/:key',
    loader: lazyLoader(() => import('./occurrenceKey'), 'occurrenceKeyLoader'),
    gbifRedirect: ({ key } = {}, { gbifOrgLocalePrefix = '' }) => {
      if (typeof key !== 'string' && typeof key !== 'number')
        throw new Error(`'Invalid key (key is of type ${typeof key})`);
      if (key === 'search') return null;
      return `${import.meta.env.PUBLIC_GBIF_ORG}${gbifOrgLocalePrefix}/occurrence/${key}`;
    },
    loadingElement: <ArticleSkeleton />,
    lazy: lazyElement(() => import('./occurrenceKey'), 'OccurrenceKey'),
    children: [
      {
        index: true,
        lazy: lazyElement(() => import('./about'), 'OccurrenceKeyAbout'),
      },
      {
        path: 'phylogenies',
        lazy: lazyElement(() => import('./phylogenies'), 'OccurrenceKeyPhylo'),
      },
      {
        path: 'cluster',
        lazy: lazyElement(() => import('./cluster'), 'OccurrenceKeyCluster'),
      },
    ],
  },
  {
    id: id + '-fragment',
    path: 'occurrence/:key/fragment',
    lazy: lazyElement(() => import('./fragment'), 'OccurrenceFragment'),
    loader: lazyLoader(() => import('./fragment'), 'occurrenceFragmentLoader'),
  },
];

export function useOccurrenceKeyLoaderData() {
  return useRenderedRouteLoaderData(id) as OccurrenceKeyLoaderResult;
}
