import { StaticRenderSuspence } from '@/components/staticRenderSuspence';
import { lazyElement, RouteObjectWithPlugins } from '@/reactRouterPlugins';
import React from 'react';
import { ToolCardSkeleton } from '../_shared/toolCardSkeleton';
import { ApiContent } from './help';

const SequenceIdPage = React.lazy(() => import('./SequenceIdPage'));

export const sequenceIdRoute: RouteObjectWithPlugins = {
  id: 'sequenceId',
  path: 'tools/sequence-id',
  loader: (args) =>
    import('../_shared/toolLayout').then((m) => m.createToolLayoutLoader('sequence_id')(args)),
  lazy: async () => {
    const { ToolLayout } = await import('../_shared/toolLayout');
    return { element: <ToolLayout defaultTitle="Sequence ID" apiContent={<ApiContent />} /> };
  },
  children: [
    {
      index: true,
      element: (
        <StaticRenderSuspence fallback={<ToolCardSkeleton />}>
          <SequenceIdPage />
        </StaticRenderSuspence>
      ),
    },
    {
      path: 'about',
      lazy: lazyElement(() => import('../_shared/toolLayout'), 'ToolAboutTab'),
    },
  ],
};
