import { StaticRenderSuspence } from '@/components/staticRenderSuspence';
import { RouteObjectWithPlugins } from '@/reactRouterPlugins';
import React from 'react';
import { BackstageLayout } from './BackstageLayout';

// The dashboard is loaded lazily so its code is split into its own chunk and is
// never part of the main site bundle — only fetched when an authorised user
// opens the backstage. Authorisation is enforced server-side (the page route
// 404s for non-admins before SSR; see gbif/server.js).
const Dashboard = React.lazy(() => import('./Dashboard'));

export const backstageRoute: RouteObjectWithPlugins = {
  id: 'backstage',
  path: 'backstage',
  element: <BackstageLayout />,
  children: [
    {
      index: true,
      element: (
        <StaticRenderSuspence fallback={null}>
          <Dashboard />
        </StaticRenderSuspence>
      ),
    },
  ],
};
