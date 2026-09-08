/**
 * Tailwind config for the design-system stylesheet.
 *
 * Identical to the app's config except for `safelist`. The app compiles only
 * the classes its own source actually uses, which is right for the app but
 * wrong for a design system: a design agent composing new screens will reach
 * for `g-bg-primary-700` or `g-border-border` — perfectly valid names in this
 * theme — and get a silent no-op because nothing in src/ happens to use them.
 *
 * The safelist below materialises the full themed palette across the four
 * utilities that carry colour, so every colour name the theme defines is
 * actually available to build with.
 */
const base = require('../tailwind.config.js');

const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const SCALED = ['primary', 'primaryContrast'];
const PAIRED = ['secondary', 'destructive', 'muted', 'accent', 'popover', 'card'];
const SINGLE = ['background', 'foreground', 'paperBackground', 'border', 'input', 'ring'];
// `fill`/`stroke` matter because the DS ships SVG components (Spinner, icons)
// that are tinted with them; without these the tint is a silent no-op.
const UTILS = ['bg', 'text', 'border', 'ring', 'fill', 'stroke'];

const names = [
  ...SCALED.flatMap((c) => [c, ...SHADES.map((s) => `${c}-${s}`)]),
  ...PAIRED.flatMap((c) => [c, `${c}-foreground`]),
  ...SINGLE,
];

// Spacing and sizing have no theme to safelist from, so they were previously
// present only by accident — whichever values `src/` happened to use. A design
// agent laying out a new screen reaches for the whole scale, and a missing class
// is a silent no-op (an earlier preview batch lost a carousel's controls to
// exactly this, with `g-p-12` of all things). Materialise the standard scale.
const SPACE = [
  '0', 'px', '0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '5', '6', '7', '8',
  '9', '10', '11', '12', '14', '16', '20', '24', '28', '32', '36', '40', '48',
  '56', '64', '72', '80', '96',
];
const SPACE_UTILS = [
  'p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe',
  'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'ms', 'me',
  'gap', 'gap-x', 'gap-y', 'space-x', 'space-y',
  'w', 'h', 'min-w', 'min-h', 'max-w', 'max-h', 'size',
  'top', 'right', 'bottom', 'left', 'start', 'end', 'inset',
];
const SIZE_KEYWORDS = ['auto', 'full', 'screen', 'min', 'max', 'fit', '1/2', '1/3', '2/3', '1/4', '3/4'];
const TEXT_SIZES = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'];
const WEIGHTS = ['normal', 'medium', 'semibold', 'bold'];

const layout = [
  ...SPACE_UTILS.flatMap((u) => SPACE.map((v) => `g-${u}-${v}`)),
  ...['w', 'h', 'min-w', 'min-h', 'max-w', 'max-h'].flatMap((u) =>
    SIZE_KEYWORDS.map((v) => `g-${u}-${v}`),
  ),
  ...['sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', 'prose'].map(
    (v) => `g-max-w-${v}`,
  ),
  ...TEXT_SIZES.map((v) => `g-text-${v}`),
  ...WEIGHTS.map((v) => `g-font-${v}`),
];

const safelist = [
  ...(base.safelist ?? []),
  ...UTILS.flatMap((u) => names.map((n) => `g-${u}-${n}`)),
  ...layout,
  // Hover states for the two utilities that realistically need them.
  ...names.flatMap((n) => [`hover:g-bg-${n}`, `hover:g-text-${n}`]),
  // Radii are theme-driven (var(--borderRadiusPx)) and easy to reach for.
  'g-rounded-sm', 'g-rounded-md', 'g-rounded-lg', 'g-rounded-full',
];

module.exports = { ...base, safelist };
