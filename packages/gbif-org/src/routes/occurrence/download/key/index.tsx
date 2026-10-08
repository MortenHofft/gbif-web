import { ArticleSkeleton } from '@/routes/resource/key/components/articleSkeleton';
import { lazyElement, lazyLoader, RouteObjectWithPlugins } from '@/reactRouterPlugins';

const id = 'downloadKey';

export const downloadKeyRoute: RouteObjectWithPlugins = {
  id,
  gbifRedirect: ({ key } = {}, { gbifOrgLocalePrefix = '' }) => {
    // assumed regex pattern for download keys: /^[0-9]*-[0-9]*$/;
    const pattern = /^[0-9]*-[0-9]*$/;
    if (typeof key !== 'string' || !pattern.test(key)) {
      throw new Error(`'Invalid key (key is of type ${typeof key})`);
    }
    // assuming that download/request and similar routes go first
    return `${import.meta.env.PUBLIC_GBIF_ORG}${gbifOrgLocalePrefix}/occurrence/download/${key}`;
  },
  path: 'occurrence/download/:key',
  loader: lazyLoader(() => import('./downloadKey'), 'downloadKeyLoader'),
  loadingElement: <ArticleSkeleton />,
  lazy: lazyElement(() => import('./downloadKey'), 'DownloadKey'),
};
