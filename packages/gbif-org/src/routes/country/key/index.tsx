import { ParticipantQuery } from '@/gql/graphql';
import {
  lazyElement,
  lazyLoader,
  RouteObjectWithPlugins,
  useRenderedRouteLoaderData,
} from '@/reactRouterPlugins';
import { redirectDocument } from 'react-router-dom';

const id = 'countryKey';

export const countryKeyRoute: RouteObjectWithPlugins = {
  id,
  gbifRedirect: ({ key } = {}, { gbifOrgLocalePrefix = '' }) => {
    if (typeof key !== 'string' && typeof key !== 'number')
      throw new Error(`'Invalid key (key is of type ${typeof key})`);
    if (key === 'search') return null;
    return `${import.meta.env.PUBLIC_GBIF_ORG}${gbifOrgLocalePrefix}/country/${key}`;
  },
  path: 'country/:countryCode',
  loader: lazyLoader(() => import('./layout'), 'countryKeyLoader'),
  lazy: lazyElement(() => import('./layout'), 'CountryKeyLayout'),
  children: [
    {
      index: true,
      loader: () => redirectDocument('./summary'),
    },
    {
      path: 'summary',
      lazy: lazyElement(() => import('./summary'), 'CountryKeySummary'),
    },
    {
      path: 'about',
      lazy: lazyElement(() => import('./about'), 'CountryKeyAbout'),
    },
    {
      path: 'publishing',
      lazy: lazyElement(() => import('./publishing'), 'CountryKeyPublishing'),
    },
    {
      path: 'participation',
      lazy: lazyElement(() => import('./participation'), 'CountryKeyParticipation'),
    },
    {
      path: 'alien-species',
      lazy: lazyElement(() => import('./alienSpecies'), 'CountryKeyAlienSpecies'),
    },
    {
      path: 'projects',
      lazy: lazyElement(() => import('./projects'), 'CountryKeyProjects'),
    },
    {
      path: 'news',
      lazy: lazyElement(() => import('./news'), 'CountryKeyNews'),
    },
    {
      path: 'publications',
      children: [
        {
          index: true,
          loader: () => redirectDocument('./from'),
        },
        {
          path: 'from',
          lazy: lazyElement(() => import('./publications/from'), 'CountryKeyPublicationsFrom'),
        },
        {
          path: 'about',
          lazy: lazyElement(() => import('./publications/about'), 'CountryKeyPublicationsAbout'),
        },
      ],
    },
  ],
};

export function useCountryKeyLoaderData() {
  return useRenderedRouteLoaderData(id) as { data: ParticipantQuery };
}

export function isParticipant(participationStatus: unknown) {
  if (typeof participationStatus !== 'string') return false;
  return ['VOTING', 'ASSOCIATE', 'AFFILIATE'].includes(participationStatus);
}
