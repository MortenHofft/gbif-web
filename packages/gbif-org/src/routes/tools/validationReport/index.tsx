import { StaticRenderSuspence } from '@/components/staticRenderSuspence';
import { RouteObjectWithPlugins } from '@/reactRouterPlugins';
import React from 'react';
import { ToolCardSkeleton } from '../_shared/toolCardSkeleton';
import { createToolLayoutLoader, ToolAboutTab } from '../_shared/toolLayout';
import { ApiContent } from './help';
import { ValidationReportLayout } from './ValidationReportLayout';

const ValidationReportPage = React.lazy(() => import('./ValidationReportPage'));

const validationReportPageElement = (
  <StaticRenderSuspence fallback={<ToolCardSkeleton />}>
    <ValidationReportPage />
  </StaticRenderSuspence>
);

export const validationReportRoute: RouteObjectWithPlugins = {
  id: 'validationReport',
  path: 'tools/validation-report',
  // Temporarily borrowing the Derived dataset tool's CMS About content until this tool has
  // its own — see the tool's task description for context.
  loader: createToolLayoutLoader('derived_dataset'),
  element: (
    <ValidationReportLayout
      defaultTitle="Darwin Core data package validator"
      apiContent={<ApiContent />}
    />
  ),
  children: [
    {
      index: true,
      element: validationReportPageElement,
    },
    {
      path: 'dataset/:key',
      element: validationReportPageElement,
    },
    {
      path: 'about',
      element: <ToolAboutTab />,
    },
  ],
};
