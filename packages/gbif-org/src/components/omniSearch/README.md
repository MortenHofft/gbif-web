# GBIF Filter Builder

A React demo for composing GBIF occurrence search filters interactively. Type filter names and values into a single input field — selected values appear as chips and the resulting URL parameters are shown below.

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Quick usage

1. Type a filter name — e.g. `basisOfRecord` or `taxonKey` — and select from the dropdown.
2. Type a value after the `=`. The dropdown switches into value mode and shows enum members, vocab concepts, live API suggestions, or range helpers depending on the filter type.
3. Press **Enter** or **Tab** to apply a suggestion, **Esc** to dismiss the dropdown, **↓** to reopen it.
4. **Backspace** on an empty input removes the last chip.
5. Copy the resulting URL parameters with the button at the bottom.

## Features

### Input modes
- **Filter-name mode** — typing without an `=` searches the filter catalogue. Matching is substring on `key`, `label`, and any optional `aliases: string[]` on the filter config, ranked so that prefix matches surface first (`year` → `year`, then `startDayOfYear`, `endDayOfYear`). Aliases let one filter expose several user-facing names (e.g. `taxonKey` matches `Taxon`, `Scientific name`, and `taxonKey`). The dropdown shows the friendly `label`, not the raw `key`.
- **Filter-value mode** — after `=`, suggestions come from the filter's type-specific source: `enum` lists, `vocabulary` (GraphQL), `suggestString` / `suggestEntity` (REST), `integerRange`, `geoTimeRange`, etc.
- **Negation** — prefix with `!` or `not ` (e.g. `!basisOfRecord=…`) to negate a filter. The chip and URL use the `!` prefix.
- **Wildcard** — `*` resolves to "has any value" / "has no value" when negated. URL-safe.
- **Free-text fallback** — typing arbitrary text that doesn't match a filter name produces a quick option that maps to the `q` (full-text) filter.

### Root-entity search
Configurable via the `rootEntities` prop. While in filter-name mode, suggestions from selected filters are inlined as sections, so typing `puma` shows taxa under "Taxon", typing `obs` shows `OBSERVATION` etc. under "Basis of Record", without having to enter the filter first.
- Each entry can be a bare key (`'taxonKey'`) or `{ key, minChars }` to require N characters before that entity fires (useful for slow vocab calls, e.g. `{ key: 'typeStatus', minChars: 3 }`).
- Each entity is fetched independently; a slow one doesn't hold back a fast one.

### Geological time
The `geologicalTime` field uses the dedicated GBIF GraphQL `geoTimeConceptSearch` vocabulary instead of a generic suggest endpoint.
- Ranges are the dominant use case: selecting a period extends the input to `Triassic,` and re-opens the dropdown to pick the second endpoint (or commit `Just Triassic`).
- Endpoint candidates are filtered by the same overlap rule as `gbif-web`: a range `A,B` is valid iff `B.startAge ≤ A.endAge`. Reversed pairs render as a disabled "periods overlap" row.
- All vocab entries are sorted oldest-first.

### Shortcuts ("Recent")
Recently applied filters resurface as a "Recent" group at the top of the dropdown. Storage lives in `filterHistory.js` (localStorage, 30-entry cap, 5 shown). The `shortcuts` prop is just a list — the FilterBuilder doesn't read or write storage itself, so you can plug in any source.

### Pinned actions ("Analysis")
The `valueActions` prop adds always-visible side actions to the bottom of the dropdown when you're in filter-value mode (sticky, doesn't scroll away). Example use: launching a facet chart for the current filter. Actions don't apply chips — they invoke a callback with `{ filterName, filterLabel, valueQuery, negated, cfg, filters }`.

### Keyboard, loading, errors
- cmdk powers arrow-key navigation, with custom handling for **Tab** (apply), **Esc** (close), **Backspace** (remove last chip on empty input), and **↓** to reopen a dismissed dropdown.
- Filter-value mode pre-seeds the dropdown with `* has any value` and a "Loading suggestions…" row while the API call is in flight.
- Fetch failures show a disabled error row below the wildcard. The `geoTimeConceptSearch` cache is invalidated on failure so the next attempt retries.

### Display
- `showChipsInInput` (default `true`) — when `false`, chips don't render inside the input box. They're still in the filter list and serialise to the URL the same way.
- `openOnFocus` (default `false`) — when `true`, focusing the input opens the dropdown with the full filter list (the original behaviour). The default keeps the dropdown closed until the user types a character or presses **↓**, so the page doesn't open with a dropdown already on screen and applying a filter doesn't leave the dropdown hanging around.
- The dropdown is mobile-responsive: on viewports ≤ 600 px the gray meta text wraps below each item's label instead of being right-aligned.

### Range presets ("Quick ranges")
`integerRange` filters accept an optional `presets` list — `{ value, label, meta? }[]` or a function returning one. They render in a "Quick ranges" section as soon as the value field is empty, so the user can pick "Last 5 years" or "Above 1 000 m" without typing a number. Use the function form when a preset depends on the current calendar year (e.g. `Last N years`) so long-lived sessions stay correct.

```js
rangeField('year', 'Year', 'Single year or range', () => {
  const y = new Date().getFullYear();
  return [
    { value: `${y}`,         label: 'This year' },
    { value: `${y-4},${y}`,  label: 'Last 5 years' },
  ];
}),
rangeField('elevation', 'Elevation', '…', [
  { value: '0,500',  label: 'Up to 500 m' },
  { value: '500,*',  label: 'Above 500 m' },
]),
```

### Per-field capability flags
Some backends don't support every predicate. Two optional booleans on a filter config let the dropdown reflect that:

- `supportsNegation` (default `true`) — when `false`, the filter is hidden from the catalogue once the user types `!` / `not `. While `!` is active the component also skips root-entity inline suggestions (taxon lookups etc.) and the free-text fallback, since those don't compose with negation.
- `supportsExistence` (default `true`) — when `false`, the wildcard ∗ "has any value" row is stripped from that filter's value-mode dropdown.

`datasetFilterConfig.js` sets both to `false` on every field via a shared default, because the registry API has neither predicate.

### URL round-tripping
`filtersToQuery` / `queryToFilters` keep the filter array in sync with `?key=value` URL parameters. `suggestEntity` filters with a `resolveLabel` fetch their display name on page load so chips read correctly when navigating to a shared link.

### Internationalisation
The component does not bundle a translation library. Localisation is the host's responsibility, so any i18n stack (react-intl, i18next, FormatJS, a hand-rolled map) can be plugged in without the component knowing.

**How translations enter the component:**

- **Static enums** — pass `values` as `{ value, label }[]` instead of bare strings. `value` is what gets serialised to the URL (and what filtering must produce); `label` is what users see and type against. The suggestion dropdown matches the typed query against both `value` and `label`, so `de` matches `Germany` even though the URL stores `DE`. `datasetFilterConfig.js` shows the pattern for `publishingCountry`, using `Intl.DisplayNames` to derive the labels.
- **`formatValue`** — chip text. Use it to render the translated label after a value is committed (the URL still serialises `value`).
- **`vocabulary` filters** — the GBIF GraphQL endpoint returns `uiLabel` already localised; pass the active locale through the GraphQL query (`language` arg) and the response is ready to display.
- **`suggestEntity` / `suggestString` filters** — labels come from the live API response; no client-side translation needed.
- **Component-owned UI strings** (the wildcard option's "has any value", range hints like "up to" / "from", error rows, "Loading suggestions…") — exposed via an optional `messages` prop. Keys are stable; the host supplies translated values for the active locale.

**The stability contract for any label-producing function the host passes in** (e.g. a `getLabel` callback, or `messages` values that themselves wrap `t(…)`):

> The function (or object) **must be referentially stable within a locale and change identity when the active locale changes.**

The component memoises translated option lists per `[filterKey, getLabel]` so typing into a 250-item country enum doesn't re-translate on every keystroke. Locale changes invalidate the memo via function identity — the component itself never reads or stores a locale. `react-intl`'s `useIntl().formatMessage` and `i18next`'s `useTranslation().t` already satisfy this contract out of the box; hand-rolled translators should wrap their lookup in `useMemo(() => translate, [locale])`.

If a host can't make their function stable (e.g. inline arrow on every render), they will see the memo bust on every render — annoying but not incorrect. A development-mode warning fires if function identity churns more than a few times per second.

## Component API

```jsx
<FilterBuilder
  value={filters}                  // FilterItem[] | undefined (uncontrolled)
  onChange={setFilters}            // fired whenever the filter list changes
  rootEntities={[
    'taxonKey',
    { key: 'typeStatus', minChars: 3 },
  ]}
  shortcuts={shortcuts}            // [{ filterName, filterLabel, value, valueLabel, negated? }]
  valueActions={[
    {
      id: 'facet-chart',
      label: '📊 View as facet chart',
      // when: cfg => cfg.type === 'enum',
      onSelect: ({ filterName, valueQuery }) => { /* … */ },
    },
  ]}
  showChipsInInput={false}         // hide chips inside the input box
  openOnFocus={false}              // dropdown only opens on type / ArrowDown
/>
```

## Project structure

```
src/
  FilterBuilder.jsx    # main component
  filterConfig.js      # filter definitions + types (enum, vocabulary, suggestEntity, …)
  filterUrl.js         # filtersToQuery / queryToFilters
  filterHistory.js     # useFilterHistory hook (localStorage shortcuts)
  utils.js             # parseInput, range helpers, geo-time vocab loader + validation
  App.jsx              # demo wrapper
  main.jsx             # entry point
index.html
vite.config.js
```

## Stack

- React 19
- Vite 5
- [cmdk](https://github.com/pacocoursey/cmdk) for the suggestion dropdown (keyboard navigation, selection state, sticky-bottom actions)
- GBIF occurrence-search suggest endpoints + GraphQL vocabulary API
- GBIF experimental taxon suggest API
