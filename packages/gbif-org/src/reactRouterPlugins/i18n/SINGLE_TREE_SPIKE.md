# Single route tree for i18n — spike result: ABANDONED (does not work)

## TL;DR

The idea was to stop the i18n plugin cloning the whole route tree once per
language (`base_routes × languages`) and instead use **two** root subtrees:

- `/` — default locale (unprefixed)
- `/:locale` — every other locale (`/fr/...`, `/de/...`)

This made the flattened route table O(1) in the number of languages and gave a
~26% SSR throughput win at 12 languages. **But it is fundamentally broken** and
has been reverted. The i18n plugin is back to the original per-language cloning.

## Why it cannot work

The localized subtree's path is a **dynamic** segment `:locale`. react-router
cannot constrain a dynamic segment to a fixed set of values, so `:locale`
matches *any* first segment — including single-segment CMS slugs handled by the
default subtree's `*` alias catch-all (`/what-is-gbif`, `/publishing-data`,
`/standards`, `/governance`, …). And a dynamic segment outranks a splat, so:

```
/standards        -> :locale="standards" + index   (WRONG: should be the alias page)
/publishing-data  -> :locale="publishing-data" + index
/fr/standards     -> :locale="fr" + *="standards"   (correct, by luck of 2 segments)
```

A locale guard then 404s the bogus `:locale`, so every default-locale
single-segment CMS page breaks (and client language-switching to a slug page
loops/redirects).

The deeper point (verified with `matchRoutes`): **a dynamic first segment cannot
distinguish a locale prefix (`/fr`) from a content slug (`/standards`)** — they
are both just one segment. Any "obvious fix" (e.g. a `:alias` route in the
default subtree) then captures `/fr` as a slug instead. The only way to
disambiguate is to make the locale prefixes **static** paths (`fr`, `de`, …) —
which is exactly the original per-language structure, i.e. O(languages) again.

## So what actually gets the perf win?

Two real options, in order of recommendation:

1. **Memoize react-router's matching** (the patch). `matchRoutes` re-runs
   `flattenRoutes` + `compilePath` on every request with no cache; both are
   request-independent. Caching them makes route *count* irrelevant to
   per-request cost, so the original (correct) per-language tree stays and the
   language penalty disappears. Caveat discovered: the SSR build bundles
   `@remix-run/router`'s **CommonJS** entry (`dist/router.cjs.js`) and the client
   uses the ESM (`dist/router.js`), so a `patch-package` fix must patch **both**
   and be re-verified on upgrades. This is the clean way to get the win without
   touching routing.

2. **True single tree via `basename`** — take the locale out of the route tree
   entirely (strip the `/fr` prefix before matching, carry the locale via
   `basename`/context). Correct and O(1), but a large refactor: the app does
   manual locale-prefixing everywhere (`localizeLink`, `DynamicLink`,
   `AlternativeLanguages`, sitemaps), which collides with `basename`
   double-prefixing, and language switching can no longer be a client navigation.

Bottom line: the route-tree restructure is a dead end; pursue the patch (1) for
the perf win, on top of the still-bigger levers (multi-process + HTML/CDN
caching).

## What remains on this branch

The i18n source is reverted to the original. The **load-testing harness** is kept
(`scripts/loadTest.mjs`, `scripts/mockApi.mjs`, `scripts/loadtest/*`, the
`/loadtest-shell` env-gated route) so the perf work can be reproduced.
