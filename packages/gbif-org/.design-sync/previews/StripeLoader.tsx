import { StripeLoader } from 'new-gbif-org-ts';

// StripeLoader draws a 1px animated stripe (`stripeLoader.module.css`,
// keyframes `stripeLoader`, colour `rgb(var(--primary))`) across the full
// width of its container. In production it never appears alone — it sits
// atop content that is loading or has failed, so every cell reproduces one
// of its two real call sites.
//
// The `active` (non-error) animation's `from` keyframe starts the moving bar
// at `left: -200px` — entirely outside the clipped container — and it only
// slides into view over the following ~1.5s of the loop. The static capture
// runs right after page load (Playwright waits for `networkidle`, which a
// local, network-free page reaches almost immediately), so it reliably
// photographs the bar mid-flight at the *start* of the loop, i.e. off-screen
// — an empty-looking box, not a rendering bug. `.sl-freeze` below pins the
// pseudo-element to a fixed, clearly-visible point in the cycle
// (`animation-delay: -1.5s` + `paused`) purely for the screenshot; the real
// component and its CSS module are untouched, and the negative delay/paused
// pair is standard CSS, not a hack around missing styles.
const FreezeStripeAnimation = () => (
  <style>{`
    .sl-freeze [class*="_active"]::before {
      animation-play-state: paused !important;
      animation-delay: -1.5s !important;
    }
  `}</style>
);

// Ported from src/components/ui/smallCard.tsx: an absolutely-positioned
// overlay across a card while its content loads.
export const LoadingCardOverlay = () => (
  <div className="sl-freeze g-relative g-w-72 g-rounded g-border g-border-solid g-border-slate-200 g-bg-card g-shadow-sm">
    <FreezeStripeAnimation />
    <div className="g-z-10 g-bg-white g-absolute g-text-center g-opacity-80 g-top-0 g-bottom-0 g-start-0 g-end-0">
      <StripeLoader active />
    </div>
    <div className="g-p-4">
      <div className="g-font-medium g-text-slate-800">Steensen Fish and Bird Museum</div>
      <div className="g-text-sm g-text-slate-500 g-mt-1">Loading collection summary...</div>
    </div>
  </div>
);

// Ported from src/components/filters/wildcardFilter.tsx: the stripe sits at
// the top edge of a facet suggestions panel while it fetches.
export const FacetSuggestionsLoading = () => (
  <div className="sl-freeze g-w-72 g-rounded g-border g-border-solid g-border-slate-200 g-bg-card g-overflow-hidden">
    <FreezeStripeAnimation />
    <StripeLoader active />
    <ul className="g-p-2 g-text-sm g-text-slate-600">
      <li className="g-px-2 g-py-1">Aves</li>
      <li className="g-px-2 g-py-1">Insecta</li>
      <li className="g-px-2 g-py-1">Mammalia</li>
    </ul>
  </div>
);

// StripeLoader's own `error` variant: the animation stops and the bar fills
// solid red edge-to-edge, used when `wildcardFilter`/`taxonFilter` fetches
// fail.
export const FacetSuggestionsError = () => (
  <div className="g-w-72 g-rounded g-border g-border-solid g-border-slate-200 g-bg-card g-overflow-hidden">
    <StripeLoader active error />
    <div className="g-p-3 g-text-sm g-text-slate-500">Could not load suggestions.</div>
  </div>
);
