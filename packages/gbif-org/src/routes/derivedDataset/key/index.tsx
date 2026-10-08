import { ArticleSkeleton } from '@/routes/resource/key/components/articleSkeleton';
import { DerivedDatasetQuery } from '@/gql/graphql';
import {
  lazyElement,
  lazyLoader,
  RouteObjectWithPlugins,
  useRenderedRouteLoaderData,
} from '@/reactRouterPlugins';

const id = 'derivedDatasetKey';

export const derivedDatasetKeyRoute: RouteObjectWithPlugins = {
  id,
  gbifRedirect: ({ doiPrefix, doiSuffix } = {}, { gbifOrgLocalePrefix = '' }) => {
    if (typeof doiPrefix !== 'string' && typeof doiSuffix !== 'string')
      throw new Error(`'Invalid doi (doi is of type ${typeof doiPrefix})`);
    return `${
      import.meta.env.PUBLIC_GBIF_ORG
    }${gbifOrgLocalePrefix}/derivedDataset/${doiPrefix}/${doiSuffix}`;
  },
  path: 'derivedDataset/:doiPrefix/:doiSuffix',
  loader: lazyLoader(() => import('./derivedDatasetKey'), 'derivedDatasetLoader'),
  loadingElement: <ArticleSkeleton />,
  lazy: lazyElement(() => import('./derivedDatasetKey'), 'DerivedDatasetPage'),
};

export function useDatasetKeyLoaderData() {
  return useRenderedRouteLoaderData(id) as { data: DerivedDatasetQuery };
}
