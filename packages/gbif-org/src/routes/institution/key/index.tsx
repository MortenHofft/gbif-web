import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  lazyElement,
  lazyLoader,
  RouteObjectWithPlugins,
  useRenderedRouteLoaderData,
} from '@/reactRouterPlugins';
import type { InstitutionKeyLoaderResult } from './institutionKey';

const id = 'institutionKey';

const withErrorBoundary = (element: JSX.Element) => <ErrorBoundary>{element}</ErrorBoundary>;

export const institutionKeyRoute: RouteObjectWithPlugins = {
  id,
  gbifRedirect: ({ key } = {}, { grSciCollLocalePrefix = '' }) => {
    if (typeof key !== 'string' && typeof key !== 'number')
      throw new Error(`'Invalid key (key is of type ${typeof key})`);
    if (key === 'search') return null;
    return `${import.meta.env.PUBLIC_GRSCICOLL}${grSciCollLocalePrefix}/institution/${key}`;
  },
  path: 'institution/:key',
  loader: lazyLoader(() => import('./institutionKey'), 'institutionLoader'),
  lazy: lazyElement(() => import('./institutionKey'), 'InstitutionKey'),
  children: [
    {
      index: true,
      lazy: lazyElement(() => import('./About'), 'default', withErrorBoundary),
    },
    {
      path: 'specimens',
      lazy: lazyElement(() => import('./Specimen'), 'default', withErrorBoundary),
    },
    {
      path: 'collections',
      lazy: lazyElement(() => import('./Collection'), 'default', withErrorBoundary),
    },
  ],
};

export function useInstitutionKeyLoaderData() {
  return useRenderedRouteLoaderData(id) as InstitutionKeyLoaderResult;
}
