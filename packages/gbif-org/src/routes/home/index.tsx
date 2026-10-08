import { HomePageQuery } from '@/gql/graphql';
import { lazyElement, LoaderArgs, RouteObjectWithPlugins } from '@/reactRouterPlugins';
import { fetchCachedResponse } from '@/utils/fetchCachedResponse';
import { json } from 'react-router-dom';

async function homepageLoader({ locale, isPreview }: LoaderArgs) {
  const response = await fetchCachedResponse({
    route: '/home',
    preview: isPreview,
    locale: locale.cmsLocale ?? 'en',
  });

  if (!response.ok) {
    // just swallow errors here and let the page render with partial data
    return json(
      { error: 'Failed to load homepage data' },
      {
        headers: {
          'GBIF-Cache-Control': 'NONE', // option are listed in gbif/entry.server but vite builds fails if trying to export/import things into the server file or vica versa
        },
      }
    ) as HomePageQuery;
  }

  return { data: await response.json() };
}

export const homePageRoute: RouteObjectWithPlugins = {
  index: true,
  id: 'home',
  lazy: lazyElement(() => import('./homePage'), 'HomePage'),
  loader: homepageLoader,
};
