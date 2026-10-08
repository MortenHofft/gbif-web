import { lazyElement, RouteObjectWithPlugins } from '@/reactRouterPlugins';

export const publisherSearchRoute: RouteObjectWithPlugins = {
  id: 'publisherSearch',
  path: 'publisher/search',
  gbifRedirect: (_, { gbifOrgLocalePrefix = '' }) => {
    return `${import.meta.env.PUBLIC_GBIF_ORG}${gbifOrgLocalePrefix}/publisher/search`;
  },
  lazy: lazyElement(() => import('./publisherSearch'), 'PublisherSearchPage'),
};
