import { useI18n } from './i18nContextProvider';

// With a single shared route tree (default at `/` and all other locales under
// `/:locale`), explicit route ids only need two variants to stay unique: the
// default-locale id, and a single suffixed id used by the localized subtree.
export const LOCALIZED_ID_SUFFIX = 'i18n';

export function localizeRouteId(routeId: string, isDefaultLocale: boolean): string {
  return isDefaultLocale ? routeId : `${routeId}-${LOCALIZED_ID_SUFFIX}`;
}

export function useLocalizedRouteId(routeId: string): string {
  const { locale, defaultLocale } = useI18n();
  return localizeRouteId(routeId, locale.code === defaultLocale.code);
}
