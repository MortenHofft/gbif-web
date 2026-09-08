## How to build with this design system

### 1. Wrap everything in `GbifPreviewProvider`

```jsx
const { GbifPreviewProvider, Card, CardHeader, CardTitle, Button } = window.GBIF;

<GbifPreviewProvider>
  {/* your page */}
</GbifPreviewProvider>
```

It is not optional. It composes the app's own providers — the same ones gbif.org
mounts — and without it a large share of the library throws rather than degrades:

- **`ConfigProvider`** with the real site config. `DataHeader` and anything calling
  `useConfig()` throws without it.
- **A data router.** Components that render links (`TabLink`, `Paging`,
  `ResultCardHeader`, `Classification`) call router hooks; the i18n layer also calls
  `useLoaderData()`, so it must be a data router, not a bare `MemoryRouter`.
- **The i18n stack** (`I18nContextProvider`, which brings `IntlProvider` and
  `DirectionProvider` with it) loaded with the real English dictionary. This covers
  both `useIntl()`/`<FormattedMessage>` and `useI18n()`, which every internal link
  calls. Components taking a `labelId`/`titleId` prop resolve it through this
  dictionary.
- **`<div className="gbif">`.** Tailwind's preflight is disabled system-wide so GBIF
  widgets can be embedded in third-party pages without resetting them; the reset is
  re-applied only under `:where(.gbif)`. Outside that class you get browser-default
  margins, bullets and heading sizes on everything.

It accepts `route` (initial path) and `dir` (`'ltr'` | `'rtl'`).

### 2. Style with `g-`-prefixed Tailwind

Every utility class in this system carries a **`g-` prefix**. `flex` does nothing;
`g-flex` is the class. Variants prefix normally: `hover:g-bg-primary-600`,
`md:g-grid-cols-2`, `focus-visible:g-ring-ring`.

Colours are theme-driven CSS variables, so use the themed names rather than raw
hexes — they are what makes output on-brand and what a theme change updates:

| Family | Names | Use for |
|---|---|---|
| `primary` | `g-bg-primary`, `g-text-primary`, `g-border-primary`, `g-ring-primary`, plus `-50` … `-950` | GBIF green (`#4C9C2E`) — primary actions, active states, links |
| `primaryContrast` | same four utilities, plus `-50` … `-950` | text/icons **on** a primary background |
| `paperBackground` | `g-bg-paperBackground` | card and panel surfaces |
| `background` / `foreground` | `g-bg-background`, `g-text-foreground` | page ground and body text |
| `border` / `input` / `ring` | `g-border-border`, `g-border-input`, `g-ring-ring` | hairlines, field borders, focus rings |
| `card`, `popover`, `muted`, `accent`, `secondary`, `destructive` | each with a `-foreground` pair, e.g. `g-bg-muted` + `g-text-muted-foreground` | surfaces and their matching text |

Radii are theme-driven too (`--borderRadiusPx`, currently `3px`):
`g-rounded-sm`, `g-rounded-md`, `g-rounded-lg`, `g-rounded-full`.

Everything else is stock Tailwind with the prefix — `g-flex`, `g-gap-4`,
`g-text-sm`, `g-mt-2`, `g-max-w-3xl`.

**One caveat that will bite you:** this stylesheet is compiled from the repo's own
source, so a class exists only if it was compiled. Guaranteed available: every themed
colour in the table above (across `bg`/`text`/`border`/`ring`/`fill`/`stroke`, plus
`hover:`), the full spacing and sizing scale (`g-p-*`, `g-m-*`, `g-gap-*`, `g-w-*`,
`g-h-*`, `g-max-w-*`, and the logical `g-ms-*`/`g-me-*`/`g-ps-*`/`g-pe-*`), text sizes
`g-text-xs`…`g-text-5xl`, and font weights. **Not** guaranteed: stock-palette colours
like `g-text-slate-600`, and arbitrary values like `g-bg-[#4C9C2E]` — those exist only
where the app already uses that exact string. Prefer the themed names; if you must
reach outside the guaranteed set, confirm the class is in `styles.css` first.

### 3. Where the truth is

- `styles.css` — the single stylesheet entry. It `@import`s `_ds_bundle.css`,
  which carries the compiled utilities and the `:root` theme variables
  (`--primary500`, `--fontFamily`, `--linkColor`, `--borderRadiusPx`, …).
  Read it when you need to confirm a class or a token exists.
- `components/<group>/<Name>/<Name>.d.ts` — the real prop contract, extracted from
  source. `<Name>.prompt.md` sits beside it with usage.
- Groups are `general`, `filters` and `resultcards`.

### 4. An idiomatic screen

```jsx
const { GbifPreviewProvider, Card, CardHeader, CardTitle, CardContent,
        Properties, Property, LicenceTag, Button } = window.GBIF;

<GbifPreviewProvider>
  <div className="g-bg-background g-min-h-screen g-p-6">
    <Card className="g-max-w-3xl g-mx-auto">
      <CardHeader>
        <CardTitle>Catalogue of Life</CardTitle>
        <div className="g-mt-2 g-flex g-items-center g-gap-2">
          <LicenceTag value="http://creativecommons.org/licenses/by/4.0/legalcode" />
        </div>
      </CardHeader>
      <CardContent>
        <Properties useDefaultTermWidths>
          <Property labelId="occurrenceFieldNames.datasetName" value="Catalogue of Life" />
          <Property labelId="occurrenceFieldNames.basisOfRecord" value="Checklist dataset" />
        </Properties>
        <Button className="g-mt-4">Download</Button>
      </CardContent>
    </Card>
  </div>
</GbifPreviewProvider>
```

Note the division of labour: library components for the controls and content, and
`g-`-prefixed utilities only for your own layout glue around them.
