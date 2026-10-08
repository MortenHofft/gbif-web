import { DeprecatedTaxonTombstoneQuery } from '@/gql/graphql';
import {
  lazyElement,
  lazyLoader,
  RouteObjectWithPlugins,
  useRenderedRouteLoaderData,
} from '@/reactRouterPlugins';

const id = 'speciesKey';

export const speciesKeyRoute: RouteObjectWithPlugins = {
  id,
  path: 'species/:key',
  gbifRedirect: ({ key } = {}, { gbifOrgLocalePrefix = '' }) => {
    if (!key) return null;
    if (typeof key !== 'string' && typeof key !== 'number')
      throw new Error(`'Invalid key (key is of type ${typeof key})`);
    if (key === 'search') return null;
    return `${import.meta.env.PUBLIC_GBIF_ORG}${gbifOrgLocalePrefix}/species/${key}`;
  },
  loader: lazyLoader(() => import('./speciesKey'), 'speciesLoader'),
  lazy: lazyElement(() => import('./speciesKey'), 'SpeciesKey'),
  children: [
    {
      // Only here to ensure that parent key is tested. Else just a 404
      path: 'verbatim',
    },
  ],
};

export function useSpeciesKeyLoaderData() {
  return useRenderedRouteLoaderData(id) as { data: DeprecatedTaxonTombstoneQuery };
}
