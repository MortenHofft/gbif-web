import { lazyElement, lazyLoader, RouteObjectWithPlugins } from '@/reactRouterPlugins';
import { ArticleSkeleton } from '@/routes/resource/key/components/articleSkeleton';

export const iptRoute: RouteObjectWithPlugins = {
  id: 'ipt',
  lazy: lazyElement(() => import('./iptPage'), 'IptPage'),
  loader: lazyLoader(() => import('./iptPage'), 'iptPageLoader'),
  loadingElement: <ArticleSkeleton />,
  path: 'ipt',
};
