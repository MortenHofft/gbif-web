import { StaticRenderSuspence } from '@/components/staticRenderSuspence';
import { RouteObjectWithPlugins } from '@/reactRouterPlugins';
import React from 'react';
import { ToolCardSkeleton } from '../_shared/toolCardSkeleton';
import { createToolLayoutLoader, ToolAboutTab, ToolLayout } from '../_shared/toolLayout';
import { ApiContent } from './help';

const ValidationReportPage = React.lazy(() => import('./ValidationReportPage'));

export const validationReportRoute: RouteObjectWithPlugins = {
  id: 'validationReport',
  path: 'tools/validation-report',
  loader: createToolLayoutLoader('validation_report'),
  element: <ToolLayout defaultTitle="Validation report" apiContent={<ApiContent />} />,
  children: [
    {
      index: true,
      element: (
        <StaticRenderSuspence fallback={<ToolCardSkeleton />}>
          <ValidationReportPage />
        </StaticRenderSuspence>
      ),
    },
    {
      path: 'about',
      element: <ToolAboutTab />,
    },
  ],
};
