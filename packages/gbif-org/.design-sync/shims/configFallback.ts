/**
 * Stand-in for `@/config/fallback` when bundling the design system.
 *
 * The real module lazy-loads its per-locale fallback message files with
 * `import.meta.glob` — a Vite compile-time feature. esbuild (which the
 * converter uses, and which must emit a single IIFE) cannot evaluate it, so in
 * the bundle it becomes `undefined` and every component throws
 * "import_meta.glob is not a function" the moment the bundle is loaded.
 *
 * Everything here is the same data from the same files; only the lazy glob
 * becomes a static import. That costs nothing in this context: the fallback
 * path exists for when the live translation endpoint is unreachable, and the
 * design system never fetches translations at all — GbifPreviewProvider
 * supplies the real dictionary directly.
 */
import type { HeaderQuery } from '@/gql/graphql';
import fallbackHeader from '@/config/fallback/header.en.json';
import fallbackMessagesEn from '@/config/fallback/messages/en.json';
import fallbackTranslationsEntry from '@/config/fallback/translations.json';

export { fallbackTranslationsEntry };

export const fallbackHeaderData = fallbackHeader as unknown as HeaderQuery;

export async function loadFallbackMessages(): Promise<Record<string, string>> {
  return fallbackMessagesEn as unknown as Record<string, string>;
}
