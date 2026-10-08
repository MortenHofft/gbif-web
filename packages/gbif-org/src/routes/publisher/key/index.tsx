import { ArticleSkeleton } from '@/routes/resource/key/components/articleSkeleton';
import {
  lazyElement,
  lazyLoader,
  RouteObjectWithPlugins,
  useRenderedRouteLoaderData,
} from '@/reactRouterPlugins';
import type { PublisherKeyLoaderResult } from './publisherKey';

const id = 'publisherKey';

export const publisherKeyRoute: RouteObjectWithPlugins = {
  id,
  gbifRedirect: ({ gbifOrgLocalePrefix = '', key } = {}) => {
    if (typeof key !== 'string' && typeof key !== 'number')
      throw new Error(`'Invalid key (key is of type ${typeof key})`);
    if (key === 'search') return null;
    return `${import.meta.env.PUBLIC_GBIF_ORG}${gbifOrgLocalePrefix}/publisher/${key}`;
  },
  path: 'publisher/:key',
  loader: lazyLoader(() => import('./publisherKey'), 'publisherLoader'),
  loadingElement: <ArticleSkeleton />,
  lazy: lazyElement(() => import('./publisherKey'), 'PublisherPage'),
  children: [
    {
      index: true,
      lazy: lazyElement(() => import('./about'), 'PublisherKeyAbout'),
    },
    {
      path: 'metrics',
      lazy: lazyElement(() => import('./metrics'), 'PublisherKeyMetrics'),
    },
    // {
    //   path: 'citations',
    //   element: <PublisherKeyCitations />,
    // },
  ],
};

export function usePublisherKeyLoaderData() {
  return useRenderedRouteLoaderData(id) as PublisherKeyLoaderResult;
}
