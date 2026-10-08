import { ArticleSkeleton } from '@/routes/resource/key/components/articleSkeleton';
import { NetworkQuery } from '@/gql/graphql';
import {
  lazyElement,
  lazyLoader,
  RouteObjectWithPlugins,
  useRenderedRouteLoaderData,
} from '@/reactRouterPlugins';

const id = 'networkKey';

export const networkKeyRoute: RouteObjectWithPlugins = {
  id,
  gbifRedirect: ({ key } = {}, { gbifOrgLocalePrefix = '' }) => {
    if (typeof key !== 'string' && typeof key !== 'number')
      throw new Error(`'Invalid key (key is of type ${typeof key})`);
    if (key === 'search') return null;
    return `${import.meta.env.PUBLIC_GBIF_ORG}${gbifOrgLocalePrefix}/network/${key}`;
  },
  path: 'network/:key',
  loader: lazyLoader(() => import('./networkKey'), 'networkLoader'),
  loadingElement: <ArticleSkeleton />,
  lazy: lazyElement(() => import('./networkKey'), 'NetworkPage'),
  children: [
    {
      index: true,
      lazy: lazyElement(() => import('./about'), 'NetworkKeyAbout'),
    },
    {
      path: 'metrics',
      lazy: lazyElement(() => import('./metrics'), 'NetworkKeyMetrics'),
    },
    {
      path: 'dataset',
      lazy: lazyElement(() => import('./dataset'), 'NetworkKeyDataset'),
    },
    {
      path: 'publisher',
      lazy: lazyElement(() => import('./publisher'), 'NetworkKeyPublisher'),
    },
  ],
};

export function useNetworkKeyLoaderData() {
  return useRenderedRouteLoaderData(id) as { data: NetworkQuery };
}
