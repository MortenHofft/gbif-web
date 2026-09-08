import { Classification, TaxonClassification, GadmClassification } from 'new-gbif-org-ts';

// Real taxonomic breadcrumb trail, as rendered on occurrence and taxon pages
// (see src/routes/taxon/key/AboutNonBackbone.tsx and occurrenceKey.tsx).
const reptileClassification = [
  { rank: 'KINGDOM', name: 'Animalia' },
  { rank: 'PHYLUM', name: 'Chordata' },
  { rank: 'CLASS', name: 'Reptilia' },
  { rank: 'ORDER', name: 'Squamata' },
  { rank: 'SUBORDER', name: 'Iguania' },
  { rank: 'FAMILY', name: 'Agamidae' },
  { rank: 'GENUS', name: 'Ctenophorus' },
  { rank: 'SPECIES', name: '<span style="font-style: italic">Ctenophorus decresii</span>' },
];

export const TaxonBreadcrumbs = () => (
  <TaxonClassification
    classification={reptileClassification}
    className="g-flex g-flex-wrap g-gap-1 g-items-center g-text-sm g-text-slate-600"
  />
);

export const MajorRanksOnly = () => (
  <TaxonClassification
    classification={reptileClassification}
    majorOnly
    className="g-flex g-flex-wrap g-gap-1 g-items-center g-text-sm g-text-slate-600"
  />
);

export const PlainCrumbs = () => (
  <Classification
    dir="ltr"
    className="g-flex g-flex-wrap g-gap-1 g-items-center g-text-xs g-text-slate-600"
  >
    <span>Australia</span>
    <span>South Australia</span>
    <span>Kangaroo Island</span>
  </Classification>
);

export const AdministrativeLevels = () => (
  <GadmClassification
    className="g-text-sm g-text-slate-600"
    gadm={{
      level0: { name: 'Australia' },
      level1: { name: 'South Australia' },
      level2: { name: 'Kangaroo Island Council' },
      level3: { name: 'Kingscote' },
      level4: { name: 'Kingscote (Suburb)' },
    }}
  />
);
