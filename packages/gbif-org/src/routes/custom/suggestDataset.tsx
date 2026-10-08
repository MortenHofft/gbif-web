import { lazyElement, RouteObjectWithPlugins } from '@/reactRouterPlugins';
import { ArticleSkeleton } from '@/routes/resource/key/components/articleSkeleton';

export const suggestDatasetRoute: RouteObjectWithPlugins = {
  id: 'suggest-dataset',
  lazy: lazyElement(() => import('./suggestDatasetPage'), 'SuggestDatasetPage'),
  loadingElement: <ArticleSkeleton />,
  path: 'suggest-dataset',
};
