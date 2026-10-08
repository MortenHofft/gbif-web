import { StaticRenderSuspence } from '@/components/staticRenderSuspence';
import { lazyElement, RouteObjectWithPlugins } from '@/reactRouterPlugins';
import React from 'react';
import { ToolCardSkeleton } from '../_shared/toolCardSkeleton';
import { ApiContent } from './help';

const SpeciesLookupPage = React.lazy(() => import('./SpeciesLookupPage'));

export const speciesLookupRoute: RouteObjectWithPlugins = {
  id: 'speciesLookup',
  path: 'tools/species-lookup',
  loader: (args) =>
    import('../_shared/toolLayout').then((m) => m.createToolLayoutLoader('species_matching')(args)),
  lazy: async () => {
    const { ToolLayout } = await import('../_shared/toolLayout');
    return { element: <ToolLayout defaultTitle="Species lookup" apiContent={<ApiContent />} /> };
  },
  children: [
    {
      index: true,
      element: (
        <StaticRenderSuspence fallback={<ToolCardSkeleton />}>
          <SpeciesLookupPage />
        </StaticRenderSuspence>
      ),
    },
    {
      path: 'about',
      lazy: lazyElement(() => import('../_shared/toolLayout'), 'ToolAboutTab'),
    },
  ],
};
