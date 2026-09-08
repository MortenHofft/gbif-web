import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from 'new-gbif-org-ts';

// Ported from src/routes/resource/key/composition/blocks/carouselBlock.tsx,
// the CMS composition block's image carousel. No network in the render
// sandbox, so each slide's photo is an inline data: URI standing in for a
// thumbor-served occurrence image — same layout the site's media gallery
// views use.
const photo = (fill: string, accentA: string, accentB: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260"><rect width="400" height="260" fill="${fill}"/><ellipse cx="150" cy="170" rx="140" ry="70" fill="${accentA}" opacity="0.7"/><circle cx="290" cy="70" r="55" fill="${accentB}" opacity="0.55"/></svg>`
  );

// `CarouselPrevious`/`CarouselNext` are absolutely positioned outside the
// carousel's own box (`-g-start-12` / `-g-end-12`, i.e. -48px) — in the app
// carouselBlock.tsx relies on its page's `g-px-10` gutter to give them room.
// A preview cell has no such surrounding page chrome, so both cells wrap in
// `g-ms-16`/`g-me-12` (64px/48px of margin — matched, not arbitrary, named
// scale classes already used elsewhere in src/ so Tailwind's JIT emits
// them); without it the previous-button circle rendered half clipped by the
// cell edge.

// A four-slide occurrence media gallery with looping enabled (as
// carouselBlock.tsx configures `opts={{ loop: true }}`), so both arrows stay
// enabled.
export const OccurrenceImageGallery = () => (
  <div className="g-py-4 g-ms-16 g-me-12">
  <Carousel opts={{ loop: true, align: 'center' }} className="g-w-96">
    <CarouselContent>
      <CarouselItem>
        <figure className="g-rounded g-overflow-hidden g-border g-border-solid g-border-slate-200">
          <img src={photo('#2f6b3a', '#3f8a2b', '#6fb84a')} alt="Vulpes vulpes" className="g-w-full g-block" />
          <figcaption className="g-p-2 g-text-sm g-text-slate-600">
            <em>Vulpes vulpes</em> — Kangaroo Island, SA
          </figcaption>
        </figure>
      </CarouselItem>
      <CarouselItem>
        <figure className="g-rounded g-overflow-hidden g-border g-border-solid g-border-slate-200">
          <img src={photo('#274a63', '#3d7397', '#e9c46a')} alt="Panthera leo" className="g-w-full g-block" />
          <figcaption className="g-p-2 g-text-sm g-text-slate-600">
            <em>Panthera leo</em> — Serengeti National Park
          </figcaption>
        </figure>
      </CarouselItem>
      <CarouselItem>
        <figure className="g-rounded g-overflow-hidden g-border g-border-solid g-border-slate-200">
          <img src={photo('#4a3f6b', '#7a68b0', '#9b8ad0')} alt="Quercus robur" className="g-w-full g-block" />
          <figcaption className="g-p-2 g-text-sm g-text-slate-600">
            <em>Quercus robur</em> — Nordic natural history collections
          </figcaption>
        </figure>
      </CarouselItem>
      <CarouselItem>
        <figure className="g-rounded g-overflow-hidden g-border g-border-solid g-border-slate-200">
          <img src={photo('#6b3f2f', '#a06a3f', '#d9b46f')} alt="Apis mellifera" className="g-w-full g-block" />
          <figcaption className="g-p-2 g-text-sm g-text-slate-600">
            <em>Apis mellifera</em> — Specimen GBIF:2847193651
          </figcaption>
        </figure>
      </CarouselItem>
    </CarouselContent>
    <CarouselPrevious />
    <CarouselNext />
  </Carousel>
  </div>
);

// A shorter, non-looping gallery (no `opts.loop`), so the "previous" arrow
// starts disabled — the state the real carousel is in the moment a page
// first loads.
export const RecordCountGalleryAtStart = () => (
  <div className="g-py-4 g-ms-16 g-me-12">
  <Carousel className="g-w-80">
    <CarouselContent>
      <CarouselItem>
        <figure className="g-rounded g-overflow-hidden g-border g-border-solid g-border-slate-200">
          <img src={photo('#3a5f3f', '#c9a24b', '#8a6a2f')} alt="Herbarium sheet" className="g-w-full g-block" />
          <figcaption className="g-p-2 g-text-sm g-text-slate-600">
            Herbarium sheet — Naturalis Biodiversity Center
          </figcaption>
        </figure>
      </CarouselItem>
      <CarouselItem>
        <figure className="g-rounded g-overflow-hidden g-border g-border-solid g-border-slate-200">
          <img src={photo('#1f4d4f', '#3f8a8a', '#7fc5c5')} alt="Turbinaria specimen" className="g-w-full g-block" />
          <figcaption className="g-p-2 g-text-sm g-text-slate-600">
            Coral voucher — Museum of Comparative Zoology
          </figcaption>
        </figure>
      </CarouselItem>
    </CarouselContent>
    <CarouselPrevious />
    <CarouselNext />
  </Carousel>
  </div>
);
