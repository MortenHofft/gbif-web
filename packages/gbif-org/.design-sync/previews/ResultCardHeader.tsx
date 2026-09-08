import { ResultCard, ResultCardHeader } from 'new-gbif-org-ts';

// Ported from src/routes/resource/key/news/newsResult.tsx — title link plus
// the content-type tag the header renders when `contentType` is supplied.
export const NewsHeaderWithTag = () => (
  <ResultCard.Container>
    <ResultCardHeader
      title="GBIF passes three billion occurrence records milestone"
      link="/news/8237"
      contentType="cms.contentType.news"
    />
    <ResultCard.Content>
      The GBIF network has now mobilised more than three billion species occurrence records from
      over 2,100 publishing institutions worldwide.
    </ResultCard.Content>
  </ResultCard.Container>
);

// Ported from src/routes/resource/key/event/eventResult.tsx — the title node
// is itself composed JSX (a link icon plus a status badge), which is the
// canonical way callers pass rich titles into ResultCardHeader.
export const EventHeaderWithStatusBadge = () => (
  <ResultCard.Container>
    <ResultCardHeader
      title={
        <span className="g-flex g-items-center g-flex-wrap g-gap-2">
          <span>GBIF Governing Board, 31st meeting</span>
          <span className="g-inline-flex g-items-center g-bg-green-100 g-text-green-800 g-text-xs g-font-medium g-px-2.5 g-py-0.5 g-rounded">
            Happening now
          </span>
        </span>
      }
      link="/event/2456"
      contentType="cms.contentType.event"
    />
    <ResultCard.Content>
      Annual meeting of GBIF Participant Node representatives, hosted by the GBIF Secretariat in
      Copenhagen, Denmark.
    </ResultCard.Content>
  </ResultCard.Container>
);

// Ported from resultCardHeader.tsx's own fallback path: `title ?? <FormattedMessage
// id="error.unknown" />` — the header still needs to render sensibly when a
// CMS record is missing its title, so the fallback text is a real code path
// worth reviewing, not an invented state.
export const MissingTitleFallback = () => (
  <ResultCard.Container>
    <ResultCardHeader title={null} link="/document/9142" contentType="cms.contentType.document" />
    <ResultCard.Content>
      This record is missing a title in the source system; the header falls back to a neutral
      placeholder rather than rendering an empty link.
    </ResultCard.Content>
  </ResultCard.Container>
);
