import { lazyElement, RouteObjectWithPlugins } from '@/reactRouterPlugins';
export const literatureSearchWidgetRoute: RouteObjectWithPlugins = {
  id: 'literatureSearchWidget',
  path: 'api/widgets/literature/latest',
  lazy: lazyElement(() => import('./literature'), 'LiteratureSearchPage'),
};

export const literatureButtonWidgetRoute: RouteObjectWithPlugins = {
  id: 'literatureButtonWidget',
  path: 'api/widgets/literature/button',
  lazy: lazyElement(() => import('./literatureButton'), 'LiteratureButton'),
};
