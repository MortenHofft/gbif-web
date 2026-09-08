import { ResultCard, ResultCardHeader, ResultCardImage } from 'new-gbif-org-ts';

// The render sandbox has no network, so a real thumbor URL paints as a broken
// image. An inline SVG data: URI goes through the component's real
// `image.file.url` prop and gives the same layout with a visible thumbnail.
// (Do NOT reach for an arbitrary Tailwind value like `g-bg-[#274a63]` here:
// arbitrary values are JIT-generated from the classes Tailwind scans in src/,
// and a preview file is not scanned — the class silently does not exist.)
const placeholder = (svg: string) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);

const toolPhoto = placeholder(
  `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120"><rect width="180" height="120" fill="#4a3f6b"/><rect x="24" y="30" width="52" height="52" rx="4" fill="#7a6ca8"/><rect x="88" y="52" width="60" height="34" rx="4" fill="#9c8fd0"/></svg>`,
);
const projectPhoto = placeholder(
  `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120"><rect width="180" height="120" fill="#274a63"/><circle cx="132" cy="38" r="18" fill="#e8c15c"/><rect y="78" width="180" height="42" fill="#356b8a"/></svg>`,
);

// Ported from src/routes/resource/key/news/newsResult.tsx — excerpt plus a
// metadata footer, no image. `g-flex-auto g-flex g-flex-col g-justify-between`
// is what pushes the date to the bottom of the card even when the excerpt is
// short.
export const ExcerptWithMetadataFooter = () => (
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
        Published 3 September 2026
      </ResultCard.Metadata>
    </ResultCard.Content>
  </ResultCard.Container>
);

// Ported from src/routes/resource/key/tool/toolResult.tsx — content sits
// beside a thumbnail in a flex row; `flex-auto` lets it fill the remaining
// width.
export const ExcerptBesideImage = () => (
  <ResultCard.Container>
    <ResultCardHeader
      title="rgbif: an R package for interfacing with the GBIF API"
      link="/tool/57"
      contentType="cms.contentType.tool"
    />
    <div className="g-flex g-gap-4">
      <ResultCard.Content>
        A community-maintained R client covering occurrence search, name matching and download
        requests against the GBIF API.
      </ResultCard.Content>
      <ResultCardImage image={{ file: { url: toolPhoto } }} link="/tool/57" />
    </div>
  </ResultCard.Container>
);

// Ported from src/routes/resource/key/project/projectResult.tsx — content
// carrying both an excerpt and a metadata block (programme link + purpose
// tags) beside an image, the densest real composition of this slot.
export const ExcerptWithMetadataAndImage = () => (
  <ResultCard.Container>
    <ResultCardHeader
      title="Mobilising biodiversity data from Nordic natural history collections"
      link="/project/104"
      contentType="cms.contentType.project"
    />
    <div className="g-flex g-gap-4">
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
        </ResultCard.Metadata>
      </ResultCard.Content>
      <ResultCardImage image={{ file: { url: projectPhoto } }} link="/project/104" />
    </div>
  </ResultCard.Container>
);
