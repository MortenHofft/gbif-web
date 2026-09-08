# design-sync notes — gbif-org

Repo-specific gotchas for future syncs. Read this before re-running.

## Shape

- **`gbif-org` is an application, not a published component library.** There is no
  `dist/` to bundle, so `--entry` points at a hand-written barrel,
  `.design-sync/entry.tsx`, which re-exports exactly the synced surface. Do NOT
  fall back to the converter's synth-entry mode: it `export *`s every file under
  `src/`, dragging routes, GraphQL documents and map engines into the bundle.
- The barrel uses **explicit named re-exports, never `export *`**, because several
  modules export the same name. Recorded decisions:
  - `ui/largeCard` wins `Card` over `ui/smallCard` (108 importers vs 64). `smallCard`
    is not synced — renaming either would ship an API the engineers don't have.
  - `ui/tabs` wins `Tabs` over `components/tabs` (the router-based tab nav).
  - `ui/separator` wins `Separator` over `dataHeader`'s.
  - `classification` wins `TaxonClassification`/`GadmClassification` over `highlights`.
- `resultCards/index.tsx` exports only the `ResultCard` namespace object. The six
  parts must be imported from their own modules — importing them from the index
  compiles but leaves them `undefined` on `window.GBIF` (`[BUNDLE_EXPORT]`).
- The `ResultCard` namespace itself is exported but deliberately NOT in
  `componentSrcMap`: it's a plain object, so a floor-card render of it would crash.

## Build inputs that are generated, not committed by hand

`cfg.buildCmd` runs `.design-sync/build-css.mjs`. Two more generators must also run
when imports change — the full sequence is:

```sh
# 1. path map for the converter's esbuild plugin (directory imports + shims)
node .design-sync/gen-tsconfig.mjs
# 2. declaration tree, so components get real prop contracts
npx tsc -p .design-sync/tsconfig.declarations.json    # exits 1 on pre-existing
                                                      # errors; it still emits
node .design-sync/fix-dts-paths.mjs
# 3. stylesheet + generated/gbif-config.json for the preview provider
node .design-sync/build-css.mjs
# 4. convert and verify
node .ds-sync/package-build.mjs --config .design-sync/config.json \
  --node-modules ./node_modules --entry ./.design-sync/entry.tsx --out ./ds-bundle
node .ds-sync/package-validate.mjs ./ds-bundle
```

Steps 1–3 are exactly what `cfg.buildCmd` runs, so `resync.mjs` does them for you.

### `gen-tsconfig.mjs`
The converter's esbuild path plugin resolves `@/x` by testing `src/x`, `src/x.ts`,
`src/x.tsx` … in order and taking the first that **exists** — and a directory
exists, so `@/config/fallback` resolves to the folder and esbuild dies with
"is a directory". The generator writes an exact `paths` rule for every `@/…`
specifier in the repo that names a directory, pointing at its real index file
(55 of them today). Exact rules are matched before the `@/*` wildcard.
**Re-run it whenever imports change.** The package `tsconfig.json` does not hit
this because esbuild's own resolver understands directories.

### `tsconfig.declarations.json` + `fix-dts-paths.mjs`
The app sets `noEmit: true`, so there is no `.d.ts` tree and the converter's prop
extractor emitted `[key: string]: unknown` for ALL 69 components — no API contract at
all for the design agent. Fix: emit declarations into `dist/types/` (auto-detected by
the converter, so `package.json` stays untouched), then rewrite the `@/…` specifiers
tsc preserves into relative paths, since the extractor's ts-morph project has no
`paths` config and the re-export chain would otherwise dangle. Root `index.d.ts` is
the types entry that points at the synced surface. Result: 3 of 69 empty, and those
three (`CardListSkeleton`, `LoadingIndicator`, `Toaster`) genuinely take no props.
Emitting also makes the entry resolvable, which surfaces all 136 sub-components as
their own cards — they are excluded via `null` entries in `componentSrcMap`.

### `build-css.mjs`
Produces `.design-sync/compiled.css` (~135 KB) from two repo sources:
1. Tailwind compiled through `.design-sync/tailwind.ds.cjs` — the app's real config
   plus a **safelist**. This matters: Tailwind only emits classes it finds in `src/`,
   so `g-bg-primary-700`, `g-border-border` and `g-ring-ring` did not exist and would
   have been silent no-ops for anyone composing new screens. The safelist materialises
   the full themed palette across bg/text/border/ring (+ hover) for ~17 KB.
   Source is `src/index.css` minus the `ol` and `maplibre-gl` imports (map components
   are out of scope, ~200 KB of unrelated CSS).
2. The runtime theme, by calling the app's own `createTheme()` and serialising with
   the same hex→"r g b" conversion `ConfigProvider` uses, extended with
   `gbifConfig.theme` read from `src/gbif/config.ts` — that's where the real brand
   lives (`primary: #4C9C2E`, `linkColor: #61A350`, Helvetica Neue, GBIF chart and
   IUCN palettes). **The base theme in `src/config/theme/baseThemes.ts` is blue
   (`#1393D8`) and is NOT what gbif.org renders.** Reading the site config rather
   than transcribing it means a brand change reaches the DS on the next sync.

**Order is load-bearing:** the `:root` theme block is appended LAST, after the
Tailwind output. `index.css` defines shadcn defaults for some of the same names
(`--background: hsl(...)`) inside `@layer base`, and `tailwind.config.js` reads them
as `rgb(var(--background))` — only the theme's "241 245 248" triples make that
valid. In the app the same override happens because ConfigProvider injects its
`<style>` after the stylesheet. This is also why `tokensGlob` is deliberately
UNSET: splitting the tokens into `tokens/*.css` would let `styles.css` import them
before `_ds_bundle.css` and the `@layer base` defaults would win.

`import.meta.env` is stubbed with the repo's `PUBLIC_*` vars only (never the rest of
`.env`, which holds credentials).

## Shims — what they are and why they are safe

`.design-sync/shims/` is remapped through the generated tsconfig. Both are build
shims, not behavioural forks, and both fail LOUDLY (esbuild "No matching export")
rather than silently if the real module drifts.

- **`reactRouterPlugins.ts`** — the real `@/reactRouterPlugins` barrel re-exports the
  same three runtime symbols from the same three modules, but ALSO imports
  `applyReactRouterPlugins`, whose plugin chain reaches the whole route tree
  (dashboards → Highcharts, map views → MapLibre/Mapbox, clusters → d3,
  phylogenies → phylotree). The barrel is not side-effect-free so the bundler
  cannot drop it. Ten synced components import from it, so excluding them was not
  an option. **If a synced component ever needs a fourth symbol from that barrel,
  add it to the shim** — the build will tell you.
- **`configFallback.ts`** — the real `@/config/fallback` lazy-loads per-locale
  messages with `import.meta.glob`, a Vite compile-time feature. esbuild cannot
  evaluate it, so in an IIFE it becomes `undefined` and EVERY component throws
  `import_meta.glob is not a function` on load. The shim imports the same JSON from
  the same files; only the lazy glob becomes a static import. Free here because the
  fallback path exists for when the live translation endpoint is unreachable, and
  the design system never fetches translations at all.

## App source change made by this sync

One behaviour-preserving refactor, agreed with the user (2026-09-08):

- **`ParentPagesContext` moved out of `standaloneWrapper.tsx` into
  `src/components/parentPagesContext.ts`.** `dynamicLink.tsx` imported only that
  context, but `standaloneWrapper.tsx` also imports `applyReactRouterPlugins`, so
  every component rendering a link pulled the entire route tree.
  `_ds_bundle.js` went from **12.4 MB → 4.6 MB**. `standaloneWrapper.tsx` re-exports
  the context, so its public API is unchanged. This likely helps the app's own
  code-splitting too. Verified no new type errors (the repo has ~1,296 pre-existing
  `tsc --noEmit` errors; the one in `dynamicLink.tsx:262` is identical on HEAD).

## Deliberate exclusions

- **`FilterButton` is not synced.** It imports `getFilterSummary` from
  `filters/filterTools.tsx`, a 1,300-line module importing every filter type
  including `geometryFilter` → `ol` + `proj4`. Keeping it cost **+2.3 MB**
  (4.6 MB vs 2.3 MB final). The user chose to drop it. `FilterPopover`,
  `FilterButtonGroup` and the rest of the filter UI are unaffected.
  To add it back, first split `getFilterSummary` into its own module.
- Maps, dashboards, phylogeny and the whole `searchTable` subtree are out of scope —
  they depend on GraphQL, map engines and charting.

## Environment

- Node **24.11.0** (`.nvmrc`); the shell default here was 22.3.0, so every command
  needs `. "$NVM_DIR/nvm.sh"; nvm use 24.11.0` first.
- **Playwright must be pinned to 1.57.0.** The machine's browser cache has
  `chromium-1200`, which 1.57.0 pins; `npm i playwright` installs a newer release
  wanting build 1243 and **the download times out on this network**. If the render
  check reports `Executable doesn't exist`, check
  `~/Library/Caches/ms-playwright/` for the cached build number and install the
  matching release rather than retrying the download.
- Install with `npm ci`/existing `node_modules` — the tree was already valid, so no
  reinstall was performed.

## Known render warns (expected — not new)

- 42 components legitimately show the typographic floor card: they were scoped for
  floor cards, not failures. Authorable on any re-sync.
- `[TOKENS_MISSING]` reports 3 of 135 referenced custom properties undefined —
  below the converter's threshold, non-blocking.
- `[DOCS_UNMAPPED]` for all components: the repo has no per-component `.md` docs,
  so every `.prompt.md` is synthesised from the `.d.ts` + the authored preview.
  Setting `cfg.docsDir` would improve this if docs are ever written.


## Preview authoring — what four parallel agents learned

### The provider is the whole ballgame

`GbifPreviewProvider` (`.design-sync/provider.tsx`) composes the app's OWN providers,
not stand-ins, because half the synced components throw without them. Two batches
independently hit this and correctly stopped rather than faking it:

- `useConfig()` → `ConfigProvider`. `DataHeader` calls it directly.
- `useI18n()` → `I18nContextProvider`. `TabLink`, `PaginationFooter` call it directly,
  and `DynamicLink` calls it for EVERY internal link — which reaches
  `ResultCardHeader`, `ResultCardImage`, `Classification`, `Table`, `TimeAgo`,
  `Carousel` and anything composing them.
- There is **no per-cell error boundary**: one uncaught hook error blanks the WHOLE
  sheet, so a single unprovided context looks like "every component is broken".
  If a whole sheet comes back white, suspect a missing provider before anything else.

`I18nContextProvider` calls `useLoaderData()`, so the provider must use
`createMemoryRouter` + `RouterProvider` — a plain `MemoryRouter` is not a data router
and `useLoaderData()` throws inside it. It also renders `<Helmet>`, hence
`HelmetProvider`. It supplies its own `IntlProvider` and `DirectionProvider`, so
nothing else should add those.

The config it receives is `.design-sync/generated/gbif-config.json`, emitted by
`build-css.mjs`. It cannot be imported directly: `src/gbif/config.ts` and
`src/config/languagesOptions.tsx` read `import.meta.env`, which esbuild leaves empty
in an IIFE, and `PUBLIC_ENABLED_LANGUAGES.split(',')` throws at load.

### Writing preview files

- **Never import `react-intl` in a preview file.** The DS bundle carries its own copy
  for the provider's `IntlProvider`; a preview importing it directly gets a SECOND
  copy from node_modules, and React context identity does not cross bundle copies
  (only react/react-dom/react-is/scheduler are shimmed to shared window globals). A
  preview-file `<FormattedMessage>` throws "Could not find required `intl` object".
  Hardcode the real English string instead — text rendered by the bundle's own
  components still resolves through the real dictionary.
- `react-icons` IS safe to import directly — no context dependency.
- **A class only exists if Tailwind compiled it — and Tailwind only scans `src/`.**
  Preview files are NOT scanned, so any class string that no file under `src/` happens
  to contain is a silent no-op. This is broader than it first looks:
  arbitrary values (`g-bg-[#274a63]`, which produced empty boxes in two
  `ResultCardContent` cells) AND perfectly ordinary named classes — a later batch lost
  a carousel's prev/next controls to `g-p-12`.
  The safelist in `.design-sync/tailwind.ds.cjs` now materialises the themed palette
  (bg/text/border/ring/fill/stroke, +hover) AND the standard spacing/sizing/text scale,
  which covers most of this. Outside those families the rule stands:
  `grep -c -F -- ".g-your-class" .design-sync/compiled.css` before trusting it.
- Radix overlays need `open` (and `modal={false}` where the prop exists) to be
  visible in a static card. `Tooltip` needs a `TooltipProvider` ancestor;
  `SimpleTooltip` forwards `open` straight through. `Select` renders correctly with
  `position="item-aligned"` and needed no `cardMode` override.
- No network in the render sandbox: real image URLs paint as broken icons. Pass an
  inline `data:image/svg+xml` URI through the component's real image prop.
- `TypeStatus` (via `ConceptValue`) lazy-loads a GraphQL vocabulary query that never
  resolves here and would render "Loading" forever — avoided.
- `TableOfContents` runs `document.querySelectorAll` in an effect; the referenced
  sections do not exist in a preview, which is a harmless no-op.

#
### Later batches added

- **`react-hook-form` IS safe to import directly in a preview file**, unlike `react-intl`.
  Only `useForm()`'s return value crosses the boundary — plain closures consumed by the
  bundle's own `FormProvider`/`Controller` via duck-typing, never `instanceof` or a shared
  context identity. (react-intl breaks because BOTH provider and consumer would be
  duplicated.) Note 7.48.2 has no top-level `errors` option on `useForm()`; use
  `form.setError()` in an effect to show a validation state.
- **`cmdk`'s `CommandInput` ignores `defaultValue`** — it is always internally controlled.
  Use local `useState` + `value`/`onValueChange` to show a typed query.
- **Raw `<a>` has no default styling** (preflight is off), so `HyperText`/`Message` links
  need the app's own `[&_a]:g-underline` convention or they look unstyled.
- **CSS-keyframe components need a frozen frame.** Capture screenshots right after
  `networkidle`, which a static preview reaches almost instantly — landing on the
  animation's first frame. `StripeLoader` parks its bar off-screen at `from`, so both
  loading cells captured an empty box. Fixed in the preview file only, with a scoped
  `<style>` setting `animation-delay: -1.5s; animation-play-state: paused`.

## Components deliberately left on the floor card

Three components cannot observably render given the surface this sync exposes. This is the
honest outcome, not a failure — each would need a source or scope change to preview:

- **`TestSiteAlert`** — reads `import.meta.env.PUBLIC_TEST_SITE` directly, which is unset in
  `.env` (present only in `.env.example`), and takes no prop to override it.
- **`Toaster`** — renders `useToast()`'s module-level store, which starts empty. The
  `toast()` dispatcher is not re-exported by `entry.tsx`, so no preview can seed it.
  Export `toast`/`useToast` from the barrel if a real preview is wanted.
- **`LoadingIndicator`** — reads `useNavigation().state`; a static memory router never has
  an in-flight navigation.

## Domain accuracy

`ResultCard.*` is used **only** for CMS resource search (News, Project, Event, Tool,
Document, Network, Programme) — never for occurrence or dataset results. Previews use
that domain deliberately. Confirmed via `grep -rln "ResultCard\." src/routes`.

### Concurrency

Running `package-build.mjs` while subagents are capturing races them — `ds-bundle/`
is shared, and agents saw `_screenshots/` and compiled HTML briefly vanish. Subagents
must only ever run `preview-rebuild.mjs --components <theirs>` and
`package-capture.mjs --components <theirs>`. The orchestrator should not rebuild while
a wave is in flight; recovery is a full rebuild + scoped recapture afterwards (grades
are keyed to sources, so they carry forward).

## Props-type name collisions — `dtsPropsFor` is load-bearing

The extractor finds a component's props by searching **the whole project** for an
interface or type literally named `<Name>Props` and taking the first hit. In an app
this size that collides, and the result is a confidently wrong contract — the worst
kind, because nothing fails. Found by scanning for it:

```sh
# For each synced component, is <Name>Props declared somewhere OTHER than its own file?
grep -rlE '(interface|type) <Name>Props\b' src
```

Five were wrong and are now pinned in `cfg.dtsPropsFor`, hand-written from source:

| Component | Was picking up |
|---|---|
| `Card` | `dashboard/shared.tsx` — advertised `padded`/`loading`/`error` |
| `Input` | `addInput.tsx` — advertised `onAdd`/`inputClassName` |
| `SearchInput` | `routes/omniSearch/SearchInput.tsx` — only `placeholder` |
| `ErrorMessage` | `routes/user/shared/FormComponents.tsx` — wrong required prop |
| `Table` | `clientTable.tsx` / three others |

Two more collide but happen to resolve correctly and are left alone: `Dialog`
(matches the Radix root props, which is right) and `Form` (matches react-hook-form's
`UseFormReturn`, which is right — `Form` IS `FormProvider`, spread with `{...form}`).

**Re-run the scan above after adding components.** And note the trade-off: a pinned
`dtsPropsFor` body no longer tracks source, so if one of these five gains a prop, the
contract must be updated by hand. That is why only the five wrong ones are pinned.

## Known cosmetic issue in the emitted contracts

20 of 69 `<Name>.d.ts` files carry a verbose `ref?:` line referencing
`React.DO_NOT_USE_OR_YOU_WILL_BE_FIRED_CALLBACK_REF_RETURN_VALUES`, and 3 carry a
truncated polymorphic union (`as?: … /* +164 more */`). Both are honest — `ref` and
`as` really are props — just noisy. Deliberately NOT fixed: the options are 20
hand-written `cfg.dtsPropsFor` bodies (which rot as the components change) or a fork
of `lib/dts.mjs` (which then needs diffing against upstream on every re-sync). The
meaningful props are all present and correct, so the cost outweighs the benefit.
Revisit only if the design agent is observed misusing these APIs.

## Found in passing, for the component owners

Two pre-existing bugs surfaced while authoring previews. Neither was touched — both
are outside this sync's scope — but both are real:

- `src/components/ui/largeCard.tsx` (~line 102): `DiscreteCardTitle`'s `displayName`
  assignment actually sets `CardTitle.displayName`. Harmless, but wrong.
- `src/components/message.tsx`, the `Unknown` export: `style={{ color: 'var(--color200)' }}`
  is missing the `rgb()` wrapper. The theme emits space-separated triples
  (`--color200: 226 232 240`), so `color: 226 232 240` is invalid and the muted grey
  never applies — `Unknown` renders in the inherited body colour. Should be
  `rgb(var(--color200))`, the convention used everywhere else in the codebase.

## Built from `main` — two previews are deliberately behind an in-flight branch

This sync is based on `origin/main`. The `claude/dataset-validation-report-graphql-*`
branch improves three things the sync consumes; until it merges, these are absent:

- `Card` gains an `asChild` prop. `previews/Card.tsx`'s `ClickableLinkCard` nests the
  anchor inside the Card instead; simplify it after the merge.
- `NoRecords` gains `defaultMessage`.
- `tailwind.config.js` gains a `mono` family — until then `g-font-mono` is a **no-op**,
  so `previews/Table.tsx` uses `g-tabular-nums` for the coordinates column.

A re-sync after that branch merges picks all three up automatically.

## Re-sync risks

- **Three build inputs are generated and gitignored — a fresh clone cannot build
  without running `cfg.buildCmd` first.** They are `.design-sync/tsconfig.json`
  (from `gen-tsconfig.mjs`), `.design-sync/compiled.css` and
  `.design-sync/generated/gbif-config.json` (both from `build-css.mjs`), plus the
  `dist/types/` tree and root `index.d.ts`. The config JSON is the sharpest edge:
  `provider.tsx` imports it directly, so without it the **bundle itself fails to
  build**, not just the styling. They are gitignored deliberately — they are build
  output that would rot in review — but that makes `buildCmd` mandatory, not
  optional. If someone adds a new directory-style `@/…` import and `gen-tsconfig.mjs`
  isn't re-run, the build fails with "is a directory".
- **The shims can silently under-serve.** They fail loudly on a missing export, but
  if `@/reactRouterPlugins` gains a heavy import inside `dynamicLink`/`i18n`/
  `useRenderedRouteLoaderData` themselves, the bundle grows again with no error.
  Watch `bundle:` in the build log — it should stay near **2.45 MB**. If it jumps,
  re-run `.design-sync/why.mjs` (a diagnostic that prints the shortest import chain
  from the barrel to each heavy dependency).
- **The theme is read from `src/gbif/config.ts`.** If the site theme moves elsewhere
  (a CMS, an env var), `build-css.mjs` will silently keep emitting the old palette.
  It throws if `gbifConfig.theme.primary` is missing, which covers the rename case
  but not a value that moves to runtime.
- **The English dictionary is bundled from
  `../react-components/dist/lib/translations/en.json`** — a *build artifact* of a
  sibling package, not a source file. On a fresh clone that file may not exist until
  `packages/react-components` has been built (`npm run build` there). If previews
  render message ids instead of text, that's the cause.
- **The Tailwind safelist is load-bearing, and it is a judgement call frozen in
  time.** `.design-sync/tailwind.ds.cjs` materialises the themed palette and the
  standard spacing/sizing/text scale precisely because Tailwind would otherwise emit
  only what `src/` happens to use. If the theme gains a colour family, or the design
  agent is seen reaching for a utility family not in the list (`grid-cols`, `opacity`,
  `shadow`, `z`), extend `UTILS`/`layout` there. The cost is ~36 KB of CSS for the
  scale that is already in.
- **55 authored previews are committed and re-used; grades are not** (they live in
  the gitignored `.cache/`, and durable verification comes from the uploaded
  `_ds_sync.json` — so a re-sync on any machine skips re-verifying unchanged
  components).
- **Three components ship the floor card on purpose** (see the section above). If a
  future sync "fixes" them without changing their source or the barrel, be suspicious
  — the likely explanation is a faked context, not a real render.
