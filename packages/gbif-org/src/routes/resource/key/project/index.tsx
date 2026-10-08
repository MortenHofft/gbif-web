import { ArticleSkeleton } from '@/routes/resource/key/components/articleSkeleton';
import { ProjectDatasetsTabFragment, ProjectPageFragment } from '@/gql/graphql';
import {
  lazyElement,
  lazyLoader,
  RouteObjectWithPlugins,
  useRenderedRouteLoaderData,
} from '@/reactRouterPlugins';
import { ProjectNewsAndEventsTabSkeleton } from './projectNewsAndEventsTab';

const id = 'projectKey';

export const projectKeyRoute: RouteObjectWithPlugins = {
  id,
  gbifRedirect: ({ key } = {}, { gbifOrgLocalePrefix = '' }) => {
    if (typeof key !== 'string' && typeof key !== 'number') throw new Error('Invalid key');
    return `${import.meta.env.PUBLIC_GBIF_ORG}${gbifOrgLocalePrefix}/project/${key}`;
  },
  path: 'project/:key',
  loader: lazyLoader(() => import('./project'), 'projectPageLoader'),
  loadingElement: <ArticleSkeleton />,
  lazy: lazyElement(() => import('./project'), 'ProjectPage'),
  isSlugified: true,
  children: [
    {
      index: true,
      lazy: lazyElement(() => import('./projectAboutTab'), 'ProjectAboutTab'),
    },
    {
      path: 'news',
      lazy: lazyElement(() => import('./projectNewsAndEventsTab'), 'ProjectNewsAndEventsTab'),
      loadingElement: <ProjectNewsAndEventsTabSkeleton />,
      loader: lazyLoader(() => import('./projectNewsAndEventsTab'), 'projectNewsAndEventsLoader'),
    },
    {
      path: 'datasets',
      lazy: lazyElement(() => import('./projectDatasetsTab'), 'ProjectDatasetsTab'),
    },
  ],
};

export function useProjectKeyLoaderData() {
  const { data } = useRenderedRouteLoaderData(id) as {
    data: { resource: ProjectPageFragment } & ProjectDatasetsTabFragment;
  };
  return data;
}
