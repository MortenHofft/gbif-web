import { ComponentType } from 'react';
import type { LoaderArgs } from '.';

/**
 * A route `lazy` that renders one export of a page module, so the module (and everything only it
 * imports) leaves the initial bundle while SSR still renders it.
 * See docs/how-to/code-splitting-and-lazy-loading.md.
 */
export function lazyElement<M, K extends keyof M>(
  // moduleId is added at build time by tagLazyRouteModules (gbif/vite.config.ts).
  load: (() => Promise<M>) & { moduleId?: string },
  exportName: K,
  wrap: (element: JSX.Element) => JSX.Element = (element) => element
) {
  return async () => {
    const Component = (await load())[exportName] as ComponentType;
    // Assigned onto the route by react-router; the server modulepreloads it (preloadModuleIds).
    return { element: wrap(<Component />), preloadModuleId: load.moduleId };
  };
}

export function getPreloadModuleId(route: object): string | undefined {
  return 'preloadModuleId' in route && typeof route.preloadModuleId === 'string'
    ? route.preloadModuleId
    : undefined;
}

/**
 * A static loader that imports its implementation on first use. The query then waits for the
 * chunk on the first client-side visit, so prefer a separate loader module for entry pages.
 */
export function lazyLoader<M, K extends keyof M>(load: () => Promise<M>, exportName: K) {
  return async (args: LoaderArgs) => {
    const loader = (await load())[exportName] as (args: LoaderArgs) => unknown;
    return loader(args);
  };
}
