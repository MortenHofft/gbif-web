import { lazyElement, lazyLoader, RouteObjectWithPlugins } from '@/reactRouterPlugins';
import { redirectDocument } from 'react-router-dom';

export const analyticsRoute: RouteObjectWithPlugins = {
  id: 'analytics',
  path: 'analytics',
  children: [
    {
      index: true,
      loader: () => redirectDocument('./global'),
    },
    {
      path: 'global',
      lazy: lazyElement(() => import('./global'), 'GlobalAnalyticsPage'),
    },
    {
      path: 'region/:regionKey',
      loader: lazyLoader(() => import('./region'), 'regionLoader'),
      lazy: lazyElement(() => import('./region'), 'RegionAnalyticsPage'),
    },
  ],
};
