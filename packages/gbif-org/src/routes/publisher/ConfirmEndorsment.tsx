import { lazyElement, lazyLoader, RouteObjectWithPlugins } from '@/reactRouterPlugins';

export const confirmEndorsmentRoute: RouteObjectWithPlugins = {
  path: 'publisher/confirm',
  lazy: lazyElement(() => import('./ConfirmEndorsmentPage'), 'ConfirmEndorsmentPage'),
  loader: lazyLoader(() => import('./ConfirmEndorsmentPage'), 'confirmEndorsmentLoader'),
};
