import { lazyElement, lazyLoader, RouteObjectWithPlugins } from '@/reactRouterPlugins';
import { ArticleSkeleton } from '@/routes/resource/key/components/articleSkeleton';
import { redirect } from 'react-router-dom';

const legacyPaths = [
  'africa',
  'asia',
  'europe',
  'latin-america',
  'north-america',
  'oceania',
  'participant-organisations',
  'gbif-affiliates',
];

export const gbifNetworkRoute: RouteObjectWithPlugins = {
  id: 'the-gbif-network',
  lazy: lazyElement(() => import('./gbifNetworkPage'), 'GbifNetworkPage'),
  loader: lazyLoader(() => import('./gbifNetworkPage'), 'gbifNetworkPageLoader'),
  loadingElement: <ArticleSkeleton />,
  path: 'the-gbif-network',
  shouldRevalidate: ({ currentUrl, nextUrl }) => {
    // Only revalidate if the pathname changed, not search params
    if (currentUrl.pathname !== nextUrl.pathname) {
      return true;
    }
    return false;
  },
  children: legacyPaths.map((path) => ({
    path,
    loader: () => redirect(`/the-gbif-network?group=${path.toUpperCase().replace(/-/g, '_')}`),
  })),
};
