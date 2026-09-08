import { ResultCard, ResultCardTag, SimpleTooltip } from 'new-gbif-org-ts';

// Ported from resultCardHeader.tsx's ResultCardHeaderBasic — the exact layout
// a ResultCardHeader builds around ResultCardTag for a static content-type
// label (no onClick, so it renders as a <span>).
export const StaticContentTypeTag = () => (
  <ResultCard.Container>
    <div className="g-flex g-items-start">
      <h3 className="g-flex-auto g-text-base g-font-semibold g-mb-2">
        GBIF Governing Board, 31st meeting
      </h3>
      <ResultCardTag>
        <span>Event</span>
      </ResultCardTag>
    </div>
    <ResultCard.Content>
      Annual meeting of GBIF Participant Node representatives, hosted by the GBIF Secretariat.
    </ResultCard.Content>
  </ResultCard.Container>
);

// Ported from src/routes/resource/key/project/projectResult.tsx — purpose
// tags rendered as buttons (onClick supplied) so the component switches to
// the interactive hover styling, each wrapped in the "set as filter" tooltip
// the real card uses.
export const ClickablePurposeFilterTags = () => (
  <ResultCard.Container>
    <ResultCard.Content>
      A two-year project digitising and publishing specimen records held by natural history
      museums in Denmark, Norway and Sweden.
      <ResultCard.Metadata>
        <div className="g-pt-2 g-flex g-gap-2">
          <SimpleTooltip title="Set as filter" side="right" asChild open>
            <ResultCardTag onClick={() => {}}>
              <span>Data digitization</span>
            </ResultCardTag>
          </SimpleTooltip>
          <ResultCardTag onClick={() => {}}>
            <span>Capacity enhancement</span>
          </ResultCardTag>
        </div>
      </ResultCard.Metadata>
    </ResultCard.Content>
  </ResultCard.Container>
);
