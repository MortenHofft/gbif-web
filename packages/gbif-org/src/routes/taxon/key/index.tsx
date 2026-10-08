import { TaxonKeyQuery } from '@/gql/graphql';
import {
  lazyElement,
  lazyLoader,
  RouteObjectWithPlugins,
  useRenderedRouteLoaderData,
} from '@/reactRouterPlugins';
import { redirectDocument } from 'react-router-dom';

const id = 'taxonKey';

export const taxonKeyRoute: RouteObjectWithPlugins = {
  id,
  path: 'taxon/:key',
  gbifRedirect: ({ key } = {}, { gbifOrgLocalePrefix = '' }) => {
    if (!key) return null; // TODO handle dataset/:key/species
    if (typeof key !== 'string' && typeof key !== 'number')
      throw new Error(`'Invalid key (key is of type ${typeof key})`);
    if (key === 'search') return null;
    // Classic backbone usage keys are integers and only /species can remap them to a taxon page.
    // Anything else is a taxonID, which gbif.org serves from /taxon.
    const path = /^\d+$/.test(String(key)) ? 'species' : 'taxon';
    return `${
      import.meta.env.PUBLIC_GBIF_ORG
    }${gbifOrgLocalePrefix}/${path}/${encodeURIComponent(key)}`;
  },
  loader: lazyLoader(() => import('./taxonKey'), 'taxonLoader'),
  /* shouldRevalidate({ currentUrl, nextUrl, defaultShouldRevalidate }) {
    if (currentUrl.pathname === nextUrl.pathname) return false;
    return defaultShouldRevalidate;
  }, */
  lazy: lazyElement(() => import('./taxonKey'), 'TaxonKey'),
  children: [
    {
      index: true,
      lazy: lazyElement(() => import('./About'), 'default'),
    },
    {
      path: 'metrics',
      lazy: lazyElement(() => import('./Metrics'), 'default'),
    },
    {
      path: 'treatments',
      loader: () => redirectDocument('../'),
    },
    {
      path: 'verbatim',
      loader: () => redirectDocument('../'),
    },
  ],
};

export function useTaxonKeyLoaderData() {
  return useRenderedRouteLoaderData(id) as { data: TaxonKeyQuery };
}
