import { ArticleSkeleton } from '@/routes/resource/key/components/articleSkeleton';
import {
  lazyElement,
  lazyLoader,
  RouteObjectWithPlugins,
  useRenderedRouteLoaderData,
} from '@/reactRouterPlugins';
import type { NodeKeyLoaderResult } from './nodeKey';

const id = 'nodeKey';

export const nodeKeyRoute: RouteObjectWithPlugins = {
  id,
  gbifRedirect: ({ key } = {}, { gbifOrgLocalePrefix = '' }) => {
    if (typeof key !== 'string' && typeof key !== 'number')
      throw new Error(`'Invalid key (key is of type ${typeof key})`);
    if (key === 'search') return null;
    return `${import.meta.env.PUBLIC_GBIF_ORG}${gbifOrgLocalePrefix}/node/${key}`;
  },
  path: 'node/:key',
  loader: lazyLoader(() => import('./nodeKey'), 'nodeLoader'),
  loadingElement: <ArticleSkeleton />,
  lazy: lazyElement(() => import('./nodeKey'), 'NodePage'),
  children: [
    {
      index: true,
      lazy: lazyElement(() => import('./about'), 'NodeKeyAbout'),
    },
  ],
};

export function useNodeKeyLoaderData() {
  return useRenderedRouteLoaderData(id) as NodeKeyLoaderResult;
}
