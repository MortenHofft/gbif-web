import { lazyElement, lazyLoader, RouteObjectWithPlugins } from '@/reactRouterPlugins';
import { Navigate } from 'react-router-dom';
import { ArticleSkeleton } from '../resource/key/components/articleSkeleton';
import { ProtectedRoute } from './shared/ProtectedRoute';

const protect = (element: JSX.Element) => <ProtectedRoute>{element}</ProtectedRoute>;

export const userRoutes: RouteObjectWithPlugins[] = [
  {
    id: 'user-login',
    path: 'user/login',
    lazy: lazyElement(() => import('./login/login'), 'LoginPage'),
  },
  {
    id: 'user-register',
    path: 'user/register',
    lazy: lazyElement(() => import('./login/login'), 'RegistrationPage'),
  },
  {
    id: 'user-updatePassword',
    path: 'user/update-password',
    loader: lazyLoader(() => import('./updatePassword/updatePassword'), 'updatePasswordLoader'),
    loadingElement: <span>loading</span>,
    lazy: lazyElement(() => import('./updatePassword/updatePassword'), 'UpdatePasswordPage'),
  },
  {
    id: 'user-changeEmail',
    path: 'user/change-email',
    lazy: lazyElement(() => import('./updateEmail/updateEmail'), 'UpdateEmailPage', protect),
  },
  {
    id: 'user-confirm',
    path: 'user/confirm',
    loader: lazyLoader(() => import('./confirm/confirm'), 'confirmLoader'),
    loadingElement: <ArticleSkeleton />,
    lazy: lazyElement(() => import('./confirm/confirm'), 'ConfirmPage'),
  },
  {
    id: 'user-profile',
    path: 'user',
    lazy: lazyElement(() => import('./profile/profileLayout'), 'UserProfileLayoutWrapper', protect),
    children: [
      {
        index: true,
        element: (() => {
          return <Navigate to="profile" replace />;
        })(),
      },
      {
        path: 'profile',
        lazy: lazyElement(() => import('./profile/profile'), 'default'),
      },
      {
        path: 'download',
        lazy: lazyElement(() => import('./downloads/downloads'), 'Downloads'),
      },
      {
        path: 'derived-datasets',
        lazy: lazyElement(() => import('./derivedDatasets/derivedDatasets'), 'DerivedDatasets'),
      },
      {
        path: 'validations',
        lazy: lazyElement(() => import('./validations/validations'), 'Validations'),
      },
    ],
  },
];
