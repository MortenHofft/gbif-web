import { lazyElement, RouteObjectWithPlugins } from '@/reactRouterPlugins';
import { ArticleSkeleton } from '@/routes/resource/key/components/articleSkeleton';

export const occurrenceSnapshotsRoute: RouteObjectWithPlugins = {
  id: 'occurrence-snapshots',
  lazy: lazyElement(() => import('./occurrenceSnapshotsPage'), 'OccurrenceSnapshots'),
  loadingElement: <ArticleSkeleton />,
  path: 'occurrence-snapshots',
};
