import { lazyElement, RouteObjectWithPlugins } from '@/reactRouterPlugins';

export const collectionSearchRoute: RouteObjectWithPlugins = {
  id: 'collectionSearch',
  path: 'collection/search',
  gbifRedirect: (_, { grSciCollLocalePrefix = '' }) => {
    return `${import.meta.env.PUBLIC_GRSCICOLL}${grSciCollLocalePrefix}/collection/search`;
  },
  lazy: lazyElement(() => import('./collectionSearch'), 'CollectionSearchPage'),
};
