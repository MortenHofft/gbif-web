import { ConfigProvider, type Config, type LanguageOption } from '@/config/config';
import { I18nContextProvider } from '@/reactRouterPlugins/i18n/i18nContextProvider';
import { MessagesProvider } from '@/reactRouterPlugins/i18n/messagesContext';
import * as React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';

// The real English dictionary the app ships (~6.3k keys), not a hand-written
// stub — components render the same labels they render in production.
import messages from '../../react-components/dist/lib/translations/en.json';

// The real gbif.org config, serialised at build time by build-css.mjs. It is
// read from JSON rather than imported from `src/gbif/config.ts` because that
// module (and `src/config/languagesOptions.tsx`) read `import.meta.env`, which
// esbuild leaves empty in an IIFE bundle — `PUBLIC_ENABLED_LANGUAGES.split(',')`
// would throw the moment the bundle loads.
import generatedConfig from './generated/gbif-config.json';

const config = generatedConfig as unknown as Config;
const locales = (config.languages ?? []) as LanguageOption[];
const defaultLocale = locales.find((l) => l.default) ?? locales[0];

type Props = {
  children?: React.ReactNode;
  /** Initial route for components that read location (TabLink, Paging). */
  route?: string;
  /** 'rtl' exercises the logical-property styling the DS is built around. */
  dir?: 'ltr' | 'rtl';
};

/**
 * The wrapper every GBIF component needs in order to render correctly.
 *
 * It composes the app's OWN providers — not stand-ins — so a component behaves
 * here exactly as it does on gbif.org:
 *
 * 1. `ConfigProvider` — supplies the real site config (endpoints, available
 *    catalogues, dataHeader/feedback settings) and injects the `:root` theme
 *    variables as a `<style>` block. `DataHeader` and anything calling
 *    `useConfig()` throws without it.
 * 2. A **data router** (`createMemoryRouter`, not plain `MemoryRouter`) —
 *    `I18nContextProvider` calls `useLoaderData()`, which only works inside a
 *    data router. Components with links (`TabLink`, `Paging`, `ResultCardHeader`,
 *    `Classification`) also need a router at all.
 * 3. `MessagesProvider` + `I18nContextProvider` — the app's own i18n stack.
 *    `I18nContextProvider` supplies `IntlProvider` and `DirectionProvider`
 *    itself, so this covers both `useIntl()`/`<FormattedMessage>` and
 *    `useI18n()`, which `DynamicLink` calls for every internal link.
 * 4. `className="gbif"` — Tailwind's preflight is DISABLED globally in
 *    `tailwind.config.js` (so GBIF widgets can be embedded in third-party pages
 *    without resetting them) and re-applied only under `:where(.gbif)` in
 *    `index.css`. Outside this class every component renders with browser
 *    default margins, list bullets and heading sizes.
 *
 * Design agents building with this library should wrap their page in it once,
 * at the root, exactly as the app does.
 */
export function GbifPreviewProvider({ children, route = '/', dir = 'ltr' }: Props) {
  const locale = React.useMemo(() => {
    if (dir === 'rtl') return locales.find((l) => l.textDirection === 'rtl') ?? defaultLocale;
    return defaultLocale;
  }, [dir]);

  const router = React.useMemo(
    () =>
      createMemoryRouter(
        [
          {
            path: '*',
            element: (
              <MessagesProvider messages={messages as unknown as Record<string, string>}>
                <I18nContextProvider
                  locale={locale}
                  defaultLocale={defaultLocale}
                  availableLocales={locales}
                >
                  <div className="gbif">{children}</div>
                </I18nContextProvider>
              </MessagesProvider>
            ),
          },
        ],
        { initialEntries: [route] },
      ),
    [children, locale, route],
  );

  return (
    <HelmetProvider>
      <ConfigProvider config={config}>
        <RouterProvider router={router} />
      </ConfigProvider>
    </HelmetProvider>
  );
}
