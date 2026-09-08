import { Img } from 'new-gbif-org-ts';

// Img is the app's <img> wrapper that swaps in a broken-image placeholder on
// error (src/components/Img.tsx). No network in the render sandbox, so:
// - the "loaded" cells pass an inline data: URI, which loads with no request
//   and shows the real image.
// - the "broken" cell deliberately points at an unreachable https URL. That
//   request fails in this sandbox exactly like a dead thumbor link would in
//   production, which is exactly the behaviour this component exists to
//   demonstrate: onError fires for real and the component renders its own
//   `failedClassName` fallback (the broken-image icon), not a browser default.
const specimenPhoto =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#3a5f3f"/><ellipse cx="120" cy="95" rx="70" ry="40" fill="#c9a24b"/><circle cx="150" cy="60" r="18" fill="#8a6a2f"/></svg>'
  );

// Ported from src/routes/occurrence/key/About/media.tsx — a specimen photo
// inside a card figure, same failedClassName the real occurrence media list
// uses.
export const SpecimenPhotoLoaded = () => (
  <figure className="g-rounded g-border g-border-solid g-border-slate-200 g-overflow-hidden g-w-60">
    <Img src={specimenPhoto} alt="Vulpes vulpes specimen, dorsal view" failedClassName="g-h-36 g-bg-slate-200" />
  </figure>
);

// Ported from src/routes/taxon/key/sections/SidebarImageCarousel.tsx — a
// contained image inside a fixed-ratio box, object-fit: contain via inline
// style (the component forwards `style` straight to the <img>).
export const ContainedThumbnail = () => (
  <div className="g-relative g-w-48 g-h-36 g-bg-neutral-100 g-rounded g-overflow-hidden g-flex g-items-center g-justify-center">
    <Img
      src={specimenPhoto}
      alt="Quercus robur leaf and acorn"
      style={{ maxWidth: '100%', height: '100%', maxHeight: '100%', display: 'block', objectFit: 'contain' }}
      failedClassName="g-w-full g-h-full"
    />
  </div>
);

// Ported from src/routes/occurrence/key/About/extensions.tsx — an
// unreachable identifier URL, so the real onError path renders the
// component's own broken-image placeholder rather than a browser icon.
export const BrokenImageFallback = () => (
  <figure className="g-rounded g-border g-border-solid g-border-slate-200 g-overflow-hidden g-w-60">
    <Img
      src="https://api.gbif.org/v1/image/unavailable/occurrence-9182736.jpg"
      alt="Occurrence 9182736"
      failedClassName="g-h-36 g-bg-slate-200"
    />
  </figure>
);
