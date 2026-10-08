import { ArticleSkeleton } from '@/routes/resource/key/components/articleSkeleton';
import {
  lazyElement,
  lazyLoader,
  RouteObjectWithPlugins,
  useRenderedRouteLoaderData,
} from '@/reactRouterPlugins';
import type { InstallationKeyLoaderResult } from './installationKey';

const id = 'installationKey';

export const installationKeyRoute: RouteObjectWithPlugins = {
  id,
  gbifRedirect: ({ key } = {}, { gbifOrgLocalePrefix = '' }) => {
    if (typeof key !== 'string' && typeof key !== 'number')
      throw new Error(`'Invalid key (key is of type ${typeof key})`);
    if (key === 'search') return null;
    return `${import.meta.env.PUBLIC_GBIF_ORG}${gbifOrgLocalePrefix}/installation/${key}`;
  },
  path: 'installation/:key',
  loader: lazyLoader(() => import('./installationKey'), 'installationLoader'),
  loadingElement: <ArticleSkeleton />,
  lazy: lazyElement(() => import('./installationKey'), 'InstallationPage'),
  children: [
    {
      index: true,
      lazy: lazyElement(() => import('./about'), 'InstallationKeyAbout'),
    },
  ],
};

export function useInstallationKeyLoaderData() {
  return useRenderedRouteLoaderData(id) as InstallationKeyLoaderResult;
}
