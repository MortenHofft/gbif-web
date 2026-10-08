import { lazyElement, RouteObjectWithPlugins } from '@/reactRouterPlugins';

export const institutionSearchRoute: RouteObjectWithPlugins = {
  id: 'institutionSearch',
  path: 'institution/search',
  gbifRedirect: (_, { grSciCollLocalePrefix = '' }) => {
    return `${import.meta.env.PUBLIC_GRSCICOLL}${grSciCollLocalePrefix}/institution/search`;
  },
  lazy: lazyElement(() => import('./institutionSearch'), 'InstitutionSearchPage'),
};
