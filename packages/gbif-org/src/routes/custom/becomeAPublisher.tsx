import { lazyElement, lazyLoader, RouteObjectWithPlugins } from '@/reactRouterPlugins';
import { ArticleSkeleton } from '@/routes/resource/key/components/articleSkeleton';

export const becomeAPublisherRoute: RouteObjectWithPlugins = {
  id: 'become-a-publisher',
  lazy: lazyElement(() => import('./becomeAPublisherPage'), 'BecomeAPublisherPage'),
  loader: lazyLoader(() => import('./becomeAPublisherPage'), 'becomeAPublisherPageLoader'),
  loadingElement: <ArticleSkeleton />,
  path: 'become-a-publisher',
};
