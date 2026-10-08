import { lazyElement, lazyLoader, RouteObjectWithPlugins } from '@/reactRouterPlugins';

export const faqRoute: RouteObjectWithPlugins = {
  id: 'faq',
  lazy: lazyElement(() => import('./faqPage'), 'FAQ'),
  loader: lazyLoader(() => import('./faqPage'), 'faqPageLoader'),
  loadingElement: <div>Loading...</div>,
  path: 'faq',
};
