import { lazyElement, RouteObjectWithPlugins } from '@/reactRouterPlugins';
import { occurrenceDownloadSqlAboutLoader } from './loader';
import { PageContainer } from '@/routes/resource/key/components/pageContainer';
import { ProtectedForm } from '@/components/protectedForm';

const signInRequired = (element: JSX.Element) => (
  <PageContainer className="g-bg-slate-100">
    <div className="g-max-w-4xl g-mx-auto">
      <ProtectedForm
        className=""
        title="Please sign in"
        message="A user account is required to download occurrence data."
      >
        {element}
      </ProtectedForm>
    </div>
  </PageContainer>
);

export const occurrenceDownloadSqlRoute: RouteObjectWithPlugins = {
  id: 'occurrenceDownloadSql',
  path: 'occurrence/download/sql',
  lazy: lazyElement(() => import('./sql'), 'OccurrenceDownloadSqlPage'),
  children: [
    {
      index: true,
      lazy: lazyElement(
        () => import('../../search/views/download/SqlDownloadFlow'),
        'SqlDownloadFlow',
        signInRequired
      ),
    },
    {
      path: 'about',
      loader: occurrenceDownloadSqlAboutLoader,
      lazy: lazyElement(() => import('./about'), 'OccurrenceDownloadSqlAbout'),
    },
  ],
};
