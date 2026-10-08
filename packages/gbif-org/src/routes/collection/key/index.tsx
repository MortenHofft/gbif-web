import {
  lazyElement,
  lazyLoader,
  RouteObjectWithPlugins,
  useRenderedRouteLoaderData,
} from '@/reactRouterPlugins';
import type { CollectionKeyLoaderResult } from './collectionKey';

const id = 'collectionKey';

export const collectionKeyRoute: RouteObjectWithPlugins = {
  id,
  path: 'collection/:key',
  gbifRedirect: ({ key } = {}, { grSciCollLocalePrefix = '' }) => {
    if (typeof key !== 'string' && typeof key !== 'number')
      throw new Error(`'Invalid key (key is of type ${typeof key})`);
    if (key === 'search') return null;
    return `${import.meta.env.PUBLIC_GRSCICOLL}${grSciCollLocalePrefix}/collection/${key}`;
  },
  loader: lazyLoader(() => import('./collectionKey'), 'collectionLoader'),
  shouldRevalidate({ currentUrl, nextUrl, defaultShouldRevalidate }) {
    if (currentUrl.pathname === nextUrl.pathname) return false;
    return defaultShouldRevalidate;
  },
  lazy: lazyElement(() => import('./collectionKey'), 'CollectionKey'),
  children: [
    {
      index: true,
      lazy: lazyElement(() => import('./About'), 'default'),
    },
    {
      path: 'specimens',
      lazy: lazyElement(() => import('./Specimen'), 'default'),
    },
    {
      path: 'dashboard',
      lazy: lazyElement(() => import('./Dashboard'), 'default'),
    },
  ],
};

export function useCollectionKeyLoaderData() {
  return useRenderedRouteLoaderData(id) as CollectionKeyLoaderResult;
}
