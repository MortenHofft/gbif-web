import { lazyElement, RouteObjectWithPlugins } from '@/reactRouterPlugins';

export const taxonSearchRoute: RouteObjectWithPlugins = {
  id: 'taxonSearch',
  path: 'taxon/search',
  gbifRedirect: (_, { gbifOrgLocalePrefix = '' }) => {
    return `${import.meta.env.PUBLIC_GBIF_ORG}${gbifOrgLocalePrefix}/species/search`;
  },
  lazy: lazyElement(() => import('./taxonSearch'), 'TaxonSearchPage'),
};
