import { Button, ResultCard, ResultCardHeader, ResultCardTag } from 'new-gbif-org-ts';
import { MdCalendarMonth, MdCalendarToday, MdLocationPin } from 'react-icons/md';

// Ported from src/routes/resource/key/event/eventResult.tsx's EventMetadata —
// location, date and action buttons. The real component reads the download
// ICS host from useConfig(), which needs a ConfigProvider this preview
// environment doesn't supply, so the calendar link is a static gbif.org URL
// instead of the templated one; everything else is the real layout.
export const EventLocationDateAndActions = () => (
  <ResultCard.Container>
    <ResultCardHeader
      title="GBIF Governing Board, 31st meeting"
      link="/event/2456"
      contentType="cms.contentType.event"
    />
    <ResultCard.Content>
      Annual meeting of GBIF Participant Node representatives, hosted by the GBIF Secretariat.
      <ResultCard.Metadata className="g-mt-2">
        <div className="g-flex g-items-center">
          <MdLocationPin className="g-me-2" />
          <div>
            <span>Denmark</span>, Copenhagen — GBIF Secretariat
          </div>
        </div>
        <div className="g-flex g-items-center">
          <MdCalendarToday className="g-me-2" />
          14 October 2026 09:00 - 17:00
        </div>
        <div className="g-mt-2 g-flex g-gap-4">
          <Button asChild variant="secondary">
            <a href="https://www.gbif.org/newsroom/events/2456.ics" className="g-flex g-gap-2">
              <MdCalendarMonth />
              Add to calendar
            </a>
          </Button>
          <Button asChild variant="ghost">
            <a href="/event/2456">See details</a>
          </Button>
        </div>
      </ResultCard.Metadata>
    </ResultCard.Content>
  </ResultCard.Container>
);

// Ported from src/routes/resource/key/project/projectResult.tsx — a
// programme link plus a row of purpose tags in the metadata slot.
export const ProjectProgrammeAndPurposeTags = () => (
  <ResultCard.Container>
    <ResultCardHeader
      title="Mobilising biodiversity data from Nordic natural history collections"
      link="/project/104"
      contentType="cms.contentType.project"
    />
    <ResultCard.Content>
      A two-year project digitising and publishing specimen records held by natural history
      museums in Denmark, Norway and Sweden.
      <ResultCard.Metadata>
        <div>
          Programme:{' '}
          <a className="hover:g-underline g-text-primary-500" href="/programme/bid">
            Biodiversity Information for Development (BID)
          </a>
        </div>
        <div className="g-pt-2 g-flex g-gap-2">
          <ResultCardTag>
            <span>Data digitization</span>
          </ResultCardTag>
          <ResultCardTag>
            <span>Data publishing</span>
          </ResultCardTag>
        </div>
      </ResultCard.Metadata>
    </ResultCard.Content>
  </ResultCard.Container>
);

// Ported from src/routes/resource/key/news/newsResult.tsx — a single-line
// icon + published-date footer, the simplest real use of this slot.
export const NewsPublishedDate = () => (
  <ResultCard.Container>
    <ResultCardHeader
      title="GBIF passes three billion occurrence records milestone"
      link="/news/8237"
      contentType="cms.contentType.news"
    />
    <ResultCard.Content>
      The GBIF network has now mobilised more than three billion species occurrence records from
      over 2,100 publishing institutions worldwide.
      <ResultCard.Metadata className="g-flex g-items-center">
        <MdCalendarToday className="g-me-2" /> Published 3 September 2026
      </ResultCard.Metadata>
    </ResultCard.Content>
  </ResultCard.Container>
);
