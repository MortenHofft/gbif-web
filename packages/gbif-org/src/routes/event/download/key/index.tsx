import { ArticleSkeleton } from '@/routes/resource/key/components/articleSkeleton';
import { lazyElement, lazyLoader, RouteObjectWithPlugins } from '@/reactRouterPlugins';

const id = 'eventDownloadKey';

export const eventDownloadKeyRoute: RouteObjectWithPlugins = {
  id,
  gbifRedirect: ({ key } = {}, { gbifOrgLocalePrefix = '' }) => {
    // assumed regex pattern for download keys: /^[0-9]*-[0-9]*$/;
    const pattern = /^[0-9]*-[0-9]*$/;
    if (typeof key !== 'string' || !pattern.test(key)) {
      throw new Error(`'Invalid key (key is of type ${typeof key})`);
    }
    // assuming that download/request and similar routes go first
    return `${import.meta.env.PUBLIC_GBIF_ORG}${gbifOrgLocalePrefix}/event/download/${key}`;
  },
  path: 'event/download/:key',
  loader: lazyLoader(() => import('./eventDownloadKey'), 'downloadKeyLoader'),
  loadingElement: <ArticleSkeleton />,
  lazy: lazyElement(() => import('./eventDownloadKey'), 'DownloadKey'),
};
