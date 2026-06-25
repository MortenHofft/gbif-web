import { Config } from '@/config/config';
import { fallbackTranslationsEntry, loadFallbackMessages } from '@/config/fallback';
import { NotFoundLoaderResponse } from '@/errors';
import { RootErrorPage } from '@/routes/rootErrorPage';
import { Outlet } from 'react-router-dom';
import { RouteObjectWithPlugins } from '..';
import { extractLocaleFromPathname } from './extractLocaleFromURL';
import { I18nContextProvider } from './i18nContextProvider';
import { LOCALIZED_ID_SUFFIX } from './useLocalizedRouteId';

export function applyI18nPlugin(
  routes: RouteObjectWithPlugins[],
  config: Config
): RouteObjectWithPlugins[] {
  if (routes.some((route) => route.path === '/')) {
    throw new Error(
      'The root route should not have route: "/" when using the i18n react-router-dom plugin'
    );
  }
  const { messages: customMessages = {} } = config;
  const defaultLanguage = config.languages.find((language) => language.default);
  if (!defaultLanguage) throw new Error('No default language found');
  const localeCodes = config.languages.map((l) => l.code);

  const translationsPromise = fetch(`${config.translationsEntryEndpoint}/translations.json`)
    .then((r) => r.json())
    .catch((err) => {
      // The site must still render even when the translations endpoint is down,
      // so fall back to the bundled snapshot instead of failing the whole app.
      console.error('Failed to load translations entry file, using bundled fallback', err);
      return fallbackTranslationsEntry;
    });

  // Enabled, non-default locale codes are the only valid URL prefixes.
  const validLocalePrefixes = new Set(
    config.languages.filter((l) => l.code !== defaultLanguage.code).map((l) => l.code)
  );

  // A single loader shared by both root routes. The locale is derived from the
  // URL (same source the extendedLoader plugin uses), so one tree can serve
  // every locale instead of cloning the whole route tree per language.
  const loader = async ({
    request,
    params,
  }: {
    request: Request;
    params: Record<string, string | undefined>;
  }) => {
    // The `/:locale` subtree matches any first segment; reject anything that is
    // not an enabled non-default locale so e.g. `/xx/...` 404s instead of
    // silently rendering the default locale under a bogus prefix. (The default
    // locale is served unprefixed via the `/` subtree, so `/en/...` is also a
    // 404 here, matching the previous per-language behaviour.)
    if (params.locale != null && !validLocalePrefixes.has(params.locale)) {
      throw new NotFoundLoaderResponse();
    }

    const pathname = new URL(request.url).pathname;
    const localeCode = extractLocaleFromPathname(pathname, localeCodes, defaultLanguage.code);
    const localeOption =
      config.languages.find((l) => l.code === localeCode) ?? defaultLanguage;
    const localeLanguage = customMessages[localeOption.code] ?? {};

    const translations = await translationsPromise;
    const messages = await fetch(
      `${config.translationsEntryEndpoint}${
        translations?.[localeOption.localeCode]?.messages ?? translations?.en?.messages
      }`
    )
      .then((r) => r.json())
      .catch(async (err) => {
        // Fall back to the bundled messages for this locale (or English) so a
        // failed translation load degrades gracefully instead of taking down
        // the whole site.
        console.error('Failed to load translations for language, using bundled fallback');
        console.error('Failed language: ', localeOption.code, localeOption.localeCode, err);
        return loadFallbackMessages(localeOption.localeCode);
      });
    return { messages: { ...messages, ...localeLanguage } };
  };

  // The provider derives the active locale from the URL at render time, so the
  // same element instance works for both the default and the localized subtree.
  const element = (
    <I18nContextProvider availableLocales={config.languages} defaultLocale={defaultLanguage}>
      <Outlet />
    </I18nContextProvider>
  );

  // Errors thrown by the root loader (e.g. the invalid-locale 404) render this
  // errorElement *instead of* the element, so it must establish the i18n context
  // itself - the 404 page uses i18n hooks (links, messages).
  const errorElement = (
    <I18nContextProvider availableLocales={config.languages} defaultLocale={defaultLanguage}>
      <RootErrorPage />
    </I18nContextProvider>
  );

  const common = {
    loader,
    element,
    errorElement,
    shouldRevalidate() {
      return false;
    },
  };

  // Root route for the default locale (unprefixed URLs).
  const rootRoutes: RouteObjectWithPlugins[] = [
    {
      description: 'Root route (default locale)',
      path: '/',
      ...common,
      children: routes,
    },
  ];

  // Only add the `/:locale` subtree when there is more than one language.
  // This keeps the flattened route table O(1) in the number of languages
  // (2x the base tree) instead of O(languages) (Nx the base tree) - which is
  // what react-router re-flattens and re-compiles on every SSR request - while
  // single-language sites (e.g. hosted portals) keep a single 1x tree.
  if (config.languages.length > 1) {
    rootRoutes.push({
      description: 'Root route (localized)',
      path: ':locale',
      ...common,
      children: suffixRouteIds(routes, LOCALIZED_ID_SUFFIX),
    });
  }

  return rootRoutes;
}

// Deep-copy the route tree and suffix any explicit ids so the localized subtree
// does not collide with the default subtree (react-router requires unique ids).
function suffixRouteIds(
  routes: RouteObjectWithPlugins[],
  suffix: string
): RouteObjectWithPlugins[] {
  return routes.map((route) => {
    const routeCopy = { ...route };

    if (Array.isArray(routeCopy.children)) {
      routeCopy.children = suffixRouteIds(routeCopy.children, suffix);
    }

    if (routeCopy.id) {
      routeCopy.id = `${routeCopy.id}-${suffix}`;
    }

    return routeCopy;
  });
}
