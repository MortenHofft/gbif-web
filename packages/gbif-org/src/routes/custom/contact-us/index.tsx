import {
  lazyElement,
  lazyLoader,
  RouteObjectWithPlugins,
  useRenderedRouteLoaderData,
} from '@/reactRouterPlugins';
import { ArticleSkeleton } from '@/routes/resource/key/components/articleSkeleton';
import { ContactUsPageQuery } from '@/gql/graphql';

const id = 'contactUs';

export const contactUsRoute: RouteObjectWithPlugins = {
  id,
  path: 'contact-us',
  loader: lazyLoader(() => import('./contactUs'), 'contactUsPageLoader'),
  loadingElement: <ArticleSkeleton />,
  lazy: lazyElement(() => import('./contactUs'), 'ContactUsPage'),
  children: [
    {
      index: true,
      lazy: lazyElement(() => import('./contactUsTab'), 'ContactUsTab'),
    },
    {
      path: 'directory',
      lazy: lazyElement(() => import('./directoryTab'), 'DirectoryTab'),
    },
  ],
};

export function useContactUsLoaderData() {
  return useRenderedRouteLoaderData(id) as { data: ContactUsPageQuery };
}
