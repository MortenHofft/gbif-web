import { ErrorBoundary } from '@/components/ErrorBoundary';
import { lazyElement, RouteObjectWithPlugins } from '@/reactRouterPlugins';

export const omniSearchRoute: RouteObjectWithPlugins = {
  id: 'omniSearch',
  gbifRedirect: (_, { gbifOrgLocalePrefix = '' }) =>
    `${import.meta.env.PUBLIC_GBIF_ORG}${gbifOrgLocalePrefix}/search`,
  path: 'search',
  lazy: lazyElement(
    () => import('./search'),
    'SearchPage',
    (element) => <ErrorBoundary>{element}</ErrorBoundary>
  ),
};
