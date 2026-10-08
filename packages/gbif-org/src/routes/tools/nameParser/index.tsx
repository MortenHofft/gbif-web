import { StaticRenderSuspence } from '@/components/staticRenderSuspence';
import { lazyElement, RouteObjectWithPlugins } from '@/reactRouterPlugins';
import React from 'react';
import { ToolCardSkeleton } from '../_shared/toolCardSkeleton';
import { ApiContent } from './help';

const NameParserPage = React.lazy(() => import('./NameParserPage'));

export const nameParserRoute: RouteObjectWithPlugins = {
  id: 'nameParser',
  path: 'tools/name-parser',
  loader: (args) =>
    import('../_shared/toolLayout').then((m) => m.createToolLayoutLoader('name_parser')(args)),
  lazy: async () => {
    const { ToolLayout } = await import('../_shared/toolLayout');
    return { element: <ToolLayout defaultTitle="Name parser" apiContent={<ApiContent />} /> };
  },
  children: [
    {
      index: true,
      element: (
        <StaticRenderSuspence fallback={<ToolCardSkeleton />}>
          <NameParserPage />
        </StaticRenderSuspence>
      ),
    },
    {
      path: 'about',
      lazy: lazyElement(() => import('../_shared/toolLayout'), 'ToolAboutTab'),
    },
  ],
};
