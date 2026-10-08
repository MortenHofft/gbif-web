import { StaticRenderSuspence } from '@/components/staticRenderSuspence';
import { lazyElement, RouteObjectWithPlugins } from '@/reactRouterPlugins';
import React from 'react';
import { ToolCardSkeleton } from '../_shared/toolCardSkeleton';
import { ApiContent } from './help';

const DerivedDatasetPage = React.lazy(() => import('./DerivedDatasetPage'));
const EditDerivedDatasetPage = React.lazy(() => import('./EditDerivedDatasetPage'));

export const derivedDatasetRoute: RouteObjectWithPlugins = {
  id: 'derivedDataset',
  path: 'derived-dataset',
  loader: (args) =>
    import('../_shared/toolLayout').then((m) => m.createToolLayoutLoader('derived_dataset')(args)),
  lazy: async () => {
    const { DerivedDatasetLayout } = await import('./derivedDatasetLayout');
    return {
      element: <DerivedDatasetLayout defaultTitle="Derived dataset" apiContent={<ApiContent />} />,
    };
  },
  children: [
    {
      index: true,
      element: (
        <StaticRenderSuspence fallback={<ToolCardSkeleton />}>
          <DerivedDatasetPage />
        </StaticRenderSuspence>
      ),
    },
    {
      path: 'edit/:doiPrefix/:doiSuffix',
      element: (
        <StaticRenderSuspence fallback={<ToolCardSkeleton />}>
          <EditDerivedDatasetPage />
        </StaticRenderSuspence>
      ),
    },
    {
      path: 'about',
      lazy: lazyElement(() => import('../_shared/toolLayout'), 'ToolAboutTab'),
    },
  ],
};
