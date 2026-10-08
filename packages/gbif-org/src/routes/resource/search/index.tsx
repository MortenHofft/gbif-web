import { lazyElement, RouteObjectWithPlugins } from '@/reactRouterPlugins';

export const resourceSearchRoute: RouteObjectWithPlugins = {
  id: 'resourceSearch',
  path: 'resource/search',
  lazy: lazyElement(() => import('./resourceSearch'), 'ResourceSearchPage'),
};
