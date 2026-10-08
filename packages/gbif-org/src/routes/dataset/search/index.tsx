import { lazyElement, RouteObjectWithPlugins } from '@/reactRouterPlugins';

export const datasetSearchRoute: RouteObjectWithPlugins = {
  id: 'datasetSearch',
  gbifRedirect: (_, { gbifOrgLocalePrefix = '' }) =>
    `${import.meta.env.PUBLIC_GBIF_ORG}${gbifOrgLocalePrefix}/dataset/search`,
  path: 'dataset/search',
  lazy: lazyElement(() => import('./datasetSearch'), 'DatasetSearchPage'),
};
