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

## Locale guard

`/:locale` matches any first segment, so the shared root loader validates it: if
the prefix is not an **enabled, non-default** locale it throws a 404
(`NotFoundLoaderResponse`). Because that throw renders the root `errorElement`
*instead of* the element, the `errorElement` is itself wrapped in
`I18nContextProvider` (and the provider tolerates missing loader data), so the
404 page - which uses i18n hooks/links - renders correctly instead of crashing.

## Verified

SSR (gbif, 12 languages), against the mock:
- `/taxon/4CGXP` (default) → 200, full content
- `/fr/taxon/4CGXP`, `/de/...` → 200 with the right `lang`/`dir` and hreflang
- `/`, `/fr` home → 200
- `/xx/taxon/...` (illegal), `/en/taxon/...` (default-as-prefix), `/ko/...`
  (disabled locale), `/zz` → **404** rendering the real not-found page

Client (hosted-portal build, languages en/fr/es), headless Chromium against the
hp harness pointed at the mock:
- `/occurrence/search` → renders, `lang="en"`
- `/fr/occurrence/search` → renders, `lang="fr"` (localized subtree works client-side)
- `/xx/occurrence/search` → renders the 404 page, no crash
- `npm run build` and `npm run build:hp` both succeed

## Remaining (left for manual verification / future work)

- **Local load + behaviour verification** by a human (validated here against the
  mock on a shared CI box; confirm against a real backend).
- **In-app language switching** between locales should be exercised manually
  (SSR + a fresh client render are verified; runtime locale toggling is not).
- **Getting to a true 1× tree**: the remaining gap to the single-language
  baseline is the constant 2× from the `/:locale` subtree. Eliminating it
  entirely (one tree, locale via basename/prefix-stripping) would recover the
  full throughput at every language count, but it's a much more invasive change
  to link generation + the server/client entries + hydration - not worth it for
  the incremental gain.
