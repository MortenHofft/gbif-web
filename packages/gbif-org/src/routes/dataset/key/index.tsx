import {
  lazyElement,
  lazyLoader,
  LoaderArgs,
  RouteObjectWithPlugins,
  useRenderedRouteLoaderData,
} from '@/reactRouterPlugins';
import { ArticleSkeleton } from '@/routes/resource/key/components/articleSkeleton';
import { redirectDocument } from 'react-router-dom';
import { DatasetKeyLoaderResult, datasetLoader } from './datasetKey.loader';
const id = 'datasetKey';

export const datasetKeyRoute: RouteObjectWithPlugins = {
  id,
  gbifRedirect: ({ key } = {}, { gbifOrgLocalePrefix = '' }) => {
    if (typeof key !== 'string' && typeof key !== 'number')
      throw new Error(`'Invalid key (key is of type ${typeof key})`);
    if (key === 'search') return null;
    return `${import.meta.env.PUBLIC_GBIF_ORG}${gbifOrgLocalePrefix}/dataset/${key}`;
  },
  path: 'dataset/:key',
  loader: datasetLoader,
  loadingElement: <ArticleSkeleton />,
  lazy: lazyElement(() => import('./datasetKey'), 'DatasetPage'),
  children: [
    {
      index: true,
      lazy: lazyElement(() => import('./about'), 'DatasetKeyAbout'),
    },
    {
      path: 'activity',
      loader: () => redirectDocument('../metrics'),
    },
    {
      path: 'metrics',
      lazy: lazyElement(() => import('./dashboard'), 'DatasetKeyDashboard'),
    },
    {
      path: 'project',
      lazy: lazyElement(() => import('./project'), 'DatasetKeyProject'),
    },
    {
      path: 'phylogenies',
      lazy: lazyElement(() => import('./phylogenies'), 'DatasetKeyPhylo'),
    },
    {
      path: 'taxon',
      lazy: lazyElement(() => import('./taxonSearch'), 'DatasetKeyTaxonSearch'),
    },
    {
      path: 'taxon/:taxonKey',
      lazy: lazyElement(() => import('./taxonKey'), 'DatasetTaxonKey'),
      loader: lazyLoader(() => import('@/routes/taxon/key/taxonKey'), 'datasetTaxonLoader'),
    },
    {
      path: 'event',
      lazy: lazyElement(() => import('./event/datasetEvents'), 'default'),
      loader: datasetLoader,
    },
    {
      path: 'event/:eventID',
      lazy: lazyElement(() => import('./event/eventID'), 'DatasetEventID'),
      loader: lazyLoader(() => import('./event/eventID'), 'eventLoader'),
    },
    {
      path: 'parentevent/:parentEventID',
      loader: ({ params }: LoaderArgs) => redirectDocument(`../event/${params.parentEventID}`),
    },
    {
      path: 'download',
      lazy: lazyElement(() => import('./download'), 'DatasetKeyDownload'),
    },
  ],
};

export function useDatasetKeyLoaderData() {
  return useRenderedRouteLoaderData(id) as DatasetKeyLoaderResult;
}
