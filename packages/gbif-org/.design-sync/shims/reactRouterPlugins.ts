/**
 * Slim stand-in for `@/reactRouterPlugins`, used only when bundling the design
 * system (wired through .design-sync/tsconfig.json).
 *
 * The real barrel re-exports these same three symbols from these same three
 * modules — nothing here is reimplemented. What it ALSO does is import
 * `applyReactRouterPlugins`, whose plugin chain reaches the entire route tree
 * (dashboards → highcharts, map views → maplibre/mapbox, clusters → d3,
 * phylogenies → phylotree). No design-system component calls that function, but
 * because the barrel is not side-effect-free the bundler cannot drop it, and it
 * added ~3.5 MB to _ds_bundle.js.
 *
 * Ten synced components import from this barrel (Table, DataHeader, TabLink,
 * TimeAgo, Classification, PaginationFooter, ResultCardHeader, ResultCardImage,
 * Carousel, FilterButton), so excluding them was not an option.
 */
export { DynamicLink, useDynamicNavigate } from '@/reactRouterPlugins/dynamicLink';
export { useI18n } from '@/reactRouterPlugins/i18n';
export { useRenderedRouteLoaderData } from '@/reactRouterPlugins/useRenderedRouteLoaderData';
