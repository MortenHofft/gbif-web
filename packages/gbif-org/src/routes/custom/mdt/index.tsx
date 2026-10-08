import { lazyElement, RouteObjectWithPlugins } from '@/reactRouterPlugins';

export const mdtRoute: RouteObjectWithPlugins = {
  id: 'mdt',
  path: 'mdt',
  gbifRedirect: (_, { gbifOrgLocalePrefix = '' }) => {
    return `${import.meta.env.PUBLIC_GBIF_ORG}${gbifOrgLocalePrefix}/mdt`;
  },
  lazy: lazyElement(() => import('./MdtData'), 'default'),
  children: [
    {
      index: true,
      id: 'mdtOccurrences',
      path: 'occurrences',
      lazy: lazyElement(() => import('./MdtOccurrences'), 'MdtOccurrences'),
    },
    {
      id: 'mdtInstallations',
      path: 'installations',
      lazy: lazyElement(() => import('./MdtInstallations'), 'MdtInstallations'),
    },
  ],
};
