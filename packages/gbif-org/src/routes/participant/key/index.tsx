import { ArticleSkeleton } from '@/routes/resource/key/components/articleSkeleton';
import { ParticipantDetailsQuery } from '@/gql/graphql';
import {
  lazyElement,
  lazyLoader,
  RouteObjectWithPlugins,
  useRenderedRouteLoaderData,
} from '@/reactRouterPlugins';

const id = 'participantKey';

// Avoid a circular dependency error (ParticipantKeyAbout/useParticipantKeyLoaderData) by wrapping it in a function (https://github.com/gbif/gbif-web/issues/1132)
export function createParticipantKeyRoute(): RouteObjectWithPlugins {
  return {
    id,
    gbifRedirect: ({ key } = {}, { gbifOrgLocalePrefix = '' }) => {
      if (typeof key !== 'string' && typeof key !== 'number')
        throw new Error(`'Invalid key (key is of type ${typeof key})`);
      if (key === 'search') return null;
      return `${import.meta.env.PUBLIC_GBIF_ORG}${gbifOrgLocalePrefix}/participant/${key}`;
    },
    path: 'participant/:key',
    loader: lazyLoader(() => import('./participantKey'), 'participantLoader'),
    loadingElement: <ArticleSkeleton />,
    lazy: lazyElement(() => import('./participantKey'), 'ParticipantPage'),
    children: [
      {
        index: true,
        lazy: lazyElement(() => import('./about'), 'ParticipantKeyAbout'),
      },
    ],
  };
}

export function useParticipantKeyLoaderData() {
  return useRenderedRouteLoaderData(id) as { data: ParticipantDetailsQuery };
}
