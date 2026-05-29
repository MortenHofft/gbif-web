// import '@/index.css';
import { Config, ConfigProvider, OverwriteConfigProvider } from '@/config/config';
import { UserProvider } from '@/contexts/UserContext';
import { Provider as JotaiProvider } from 'jotai';
import React from 'react';
import { Helmet, HelmetProvider } from 'react-helmet-async';

type Props = {
  config: Config;
  children: React.ReactNode;
  helmetContext?: {};
};

export function Root({ config, helmetContext, children }: Props) {
  return (
    <React.StrictMode>
      <ConfigProvider config={config}>
        <HelmetProvider context={helmetContext}>
          <Helmet>
            <title>{config.defaultTitle}</title>
          </Helmet>
          {/* JotaiProvider scopes the URL store to this React tree — critical
              for SSR, where multiple concurrent requests must not share state.
              JotaiUrlSync (mounted inside each root layout) populates the
              store from react-router's useSearchParams. */}
          <JotaiProvider>{children}</JotaiProvider>
        </HelmetProvider>
      </ConfigProvider>
    </React.StrictMode>
  );
}

export function StandaloneRoot({ config, children }: Omit<Props, 'helmetContext'>) {
  return (
    <React.StrictMode>
      <OverwriteConfigProvider config={config}>
        <UserProvider>
          <HelmetProvider>
            <JotaiProvider>{children}</JotaiProvider>
          </HelmetProvider>
        </UserProvider>
      </OverwriteConfigProvider>
    </React.StrictMode>
  );
}
