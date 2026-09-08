import { ResultCardTag, SimpleTooltip } from 'new-gbif-org-ts';
import { MdInfoOutline } from 'react-icons/md';

// `open` is forced so the tooltip content renders statically — a closed
// tooltip shows nothing to grade. Ported from
// src/routes/taxon/key/taxonKeyPresentation.tsx: an `asChild` trigger wrapping
// a vernacular name plus an info icon.
export const VernacularNameSource = () => (
  <SimpleTooltip asChild title="Common name according to: Catalogue of Life" open>
    <span className="g-inline-flex g-items-center g-gap-1 g-text-sm">
      <span>Eurasian magpie</span>
      <MdInfoOutline />
    </span>
  </SimpleTooltip>
);

// Ported from src/components/conceptValue.tsx — no `asChild`, the trigger is
// plain text (a Darwin Core basisOfRecord vocabulary term), title is a
// definition.
export const BasisOfRecordDefinition = () => (
  <SimpleTooltip
    open
    title={
      <div>
        A record based on an observation of an organism made by a person. No physical specimen was
        collected.
      </div>
    }
  >
    <span className="g-underline g-decoration-dotted g-text-sm">Human observation</span>
  </SimpleTooltip>
);

// Ported from src/routes/resource/key/project/projectResult.tsx — the
// `i18nKey="filterSupport.setFilter"` tooltip wrapping a clickable
// ResultCardTag, `side="right"` so the bubble opens away from the card edge.
export const SetFilterTagTooltip = () => (
  <SimpleTooltip i18nKey="filterSupport.setFilter" side="right" asChild open>
    <ResultCardTag onClick={() => {}}>
      <span>Data digitization</span>
    </ResultCardTag>
  </SimpleTooltip>
);
