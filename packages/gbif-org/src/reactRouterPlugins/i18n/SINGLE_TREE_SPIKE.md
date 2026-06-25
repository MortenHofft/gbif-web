# Single route tree for i18n (spike)

## What changed

The i18n react-router plugin used to **clone the entire route tree once per
enabled language** (`config.languages.map(...)`), so the flattened route table
was `base_routes × languages`. `@remix-run/router` re-flattens and re-compiles
that whole table (`matchRoutes` → `flattenRoutes` + `compilePath`) on **every
SSR request**, so the per-request matching cost grew linearly with the number of
languages.

This spike replaces the N-way duplication with **at most two root subtrees**:

- `/` — the default locale (unprefixed URLs)
- `/:locale` — every non-default locale (`/fr/...`, `/de/...`), added only when
  more than one language is enabled

so the flattened table is **O(1) in the number of languages** (1× for a single
language, 2× for many) instead of O(languages).

Files:
- `reactRouterPlugins/i18n/plugin.tsx` — two root routes sharing one tree + one
  URL-derived translations loader, instead of one cloned tree per language.
- `reactRouterPlugins/i18n/i18nContextProvider.tsx` — derives the active locale
  from the URL (it used to come from the per-language route).
- `reactRouterPlugins/i18n/useLocalizedRouteId.ts` — two id variants (default /
  `-i18n`) instead of one per language, so ids stay unique across the two
  subtrees.

`entry.server.tsx` / `entry.client.tsx` are unchanged — the `/:locale` segment
lives in the route tree, so react-router matches prefixed URLs natively on both
the server and the client (hydration stays symmetric).

## Benchmark (taxon page, single Node process, closed-loop concurrency 8)

|                         | 1 language | 12 languages |
| ----------------------- | ---------- | ------------ |
| multi-tree (current)    | ~53 req/s  | ~31 req/s    |
| single-tree (this spike)| ~44-53 req/s | **~39 req/s** |

- **Current** throughput drops ~40% from 1 → 12 languages (the duplication cost).
- **Single-tree** is essentially flat across language count — the scaling
  penalty is gone. At prod's 12 languages it is **~26% faster** (~39 vs ~31).
- This also showed the per-language *render* work (`AlternativeLanguages` emits
  one `<link hreflang>` per language through react-helmet) is negligible — the
  whole penalty was route matching.

(Numbers are from a shared box with ±10-15% run-to-run variance; the ratios are
the reliable part.)

## Correctness verified (SSR)

- `/taxon/4CGXP` (default) → 200, full content
- `/fr/taxon/4CGXP`, `/de/...` → 200 with the right `lang`/`dir` and hreflang
- `/`, `/fr` home → 200

## Not done / follow-up before this is production-ready

- **Client + hosted-portal validation**: SSR is verified, but client-side
  navigation, hydration, and language switching across the new `/:locale` subtree
  need testing (especially the hp build, which shares this plugin).
- **Invalid locale prefixes**: `/:locale` will match any first segment; add
  validation/redirect so e.g. `/xx/taxon/...` 404s or redirects rather than
  rendering the default locale under a bogus prefix.
- **Getting to a true 1× tree**: the remaining gap to the single-language
  baseline is the constant 2× from the `/:locale` subtree. Eliminating it
  entirely (one tree, locale via basename/prefix-stripping) would recover the
  full throughput at every language count, but it's a more invasive change to the
  server/client entries and hydration.
