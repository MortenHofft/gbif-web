import { lazyElement, RouteObjectWithPlugins } from '@/reactRouterPlugins';
import { occurrenceDownloadAboutLoader } from './loader';
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

export const occurrenceDownloadRequestRoute: RouteObjectWithPlugins = {
  path: 'occurrence/download/request',
  lazy: lazyElement(() => import('./layout'), 'OccurrenceDownloadPage'),
  // External sites POST a predicate here as a plain form submission (see gbif/server.js,
  // which reads it into window.__INITIAL_PREDICATE__ before this renders). React Router's
  // static handler 405s any POST to a route with no action, so this no-op action is required
  // purely to make the POST valid - the predicate itself is picked up client-side, not here.
  action: async () => null,
  children: [
    {
      index: true,
      // The page uses session storage and can therefore not be server side rendered
      lazy: lazyElement(
        () => import('../../search/views/download/PredicateDownloadFlow'),
        'PredicateDownloadFlow',
        signInRequired
      ),
    },
    {
      path: 'about',
      loader: occurrenceDownloadAboutLoader,
      lazy: lazyElement(() => import('./about'), 'OccurrenceDownloadAbout'),
    },
  ],
};
