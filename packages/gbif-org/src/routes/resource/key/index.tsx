import { resourceRedirectLoader } from './resourceRedirect';
import { ArticleSkeleton } from '@/routes/resource/key/components/articleSkeleton';
import { lazyElement, lazyLoader, LoaderArgs, RouteObjectWithPlugins } from '@/reactRouterPlugins';
import { projectKeyRoute } from './project';
import { redirect } from 'react-router-dom';

// These routes are all connected by the fact that
// 1. resource/:key will redirect to the appropriate resource page
// 2. [any-resource]/:key will redirect to the appropriate resource page
// For that reason they are all grouped together here.

export const resourceKeyRoutes: RouteObjectWithPlugins[] = [
  projectKeyRoute,
  {
    id: 'article-key',
    path: 'article/:key',
    loader: lazyLoader(() => import('./article/article'), 'articlePageLoader'),
    loadingElement: <ArticleSkeleton />,
    lazy: lazyElement(() => import('./article/article'), 'ArticlePage'),
    isSlugified: true,
  },
  {
    id: 'news-key',
    path: 'news/:key',
    loader: lazyLoader(() => import('./news/news'), 'newsPageLoader'),
    loadingElement: <ArticleSkeleton />,
    lazy: lazyElement(() => import('./news/news'), 'NewsPage'),
    isSlugified: true,
  },
  {
    id: 'event-key',
    path: 'event/:key',
    loader: lazyLoader(() => import('./event/event'), 'eventPageLoader'),
    loadingElement: <ArticleSkeleton />,
    lazy: lazyElement(() => import('./event/event'), 'EventPage'),
    isSlugified: true,
  },
  {
    id: 'tool-key',
    path: 'tool/:key',
    loader: lazyLoader(() => import('./tool/tool'), 'toolPageLoader'),
    loadingElement: <ArticleSkeleton />,
    lazy: lazyElement(() => import('./tool/tool'), 'ToolPage'),
    isSlugified: true,
  },
  {
    id: 'datause-redirect',
    path: 'datause/:key',
    loader: ({ params }: LoaderArgs) => redirect(`/data-use/${params.key}`),
  },
  {
    id: 'data-use-key',
    path: 'data-use/:key',
    loader: lazyLoader(() => import('./dataUse/dataUse'), 'dataUsePageLoader'),
    loadingElement: <ArticleSkeleton />,
    lazy: lazyElement(() => import('./dataUse/dataUse'), 'DataUsePage'),
    isSlugified: true,
  },
  {
    id: 'document-key',
    path: 'document/:key',
    loader: lazyLoader(() => import('./document/document'), 'documentPageLoader'),
    loadingElement: <ArticleSkeleton />,
    lazy: lazyElement(() => import('./document/document'), 'DocumentPage'),
    isSlugified: true,
  },
  {
    id: 'programme-key',
    path: 'programme/:key',
    loader: lazyLoader(() => import('./programme/programme'), 'programmePageLoader'),
    loadingElement: <ArticleSkeleton />,
    lazy: lazyElement(() => import('./programme/programme'), 'ProgrammePage'),
    isSlugified: true,
  },
  {
    id: 'composition-key',
    path: 'composition/:key',
    loader: lazyLoader(() => import('./composition/composition'), 'compositionPageLoader'),
    loadingElement: <ArticleSkeleton />,
    lazy: lazyElement(() => import('./composition/composition'), 'CompositionPage'),
    isSlugified: true,
  },
  {
    id: 'resource-redirect-key',
    path: 'resource/:key',
    loader: resourceRedirectLoader,
    loadingElement: <ArticleSkeleton />,
  },
  {
    id: 'alias-handling',
    path: '*',
    loader: lazyLoader(() => import('./aliasHandling'), 'aliasHandlingLoader'),
    loadingElement: <ArticleSkeleton />,
    lazy: lazyElement(() => import('./aliasHandling'), 'AliasHandling'),
  },
];
