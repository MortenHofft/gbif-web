import { lazyElement, RouteObjectWithPlugins } from '@/reactRouterPlugins';

export const eventSearchRouteId = 'eventSearch';

export const eventSearchRoute: RouteObjectWithPlugins = {
  id: eventSearchRouteId,
  path: 'event/search',
  lazy: lazyElement(() => import('./eventSearchPage'), 'EventSearchPage'),
};
