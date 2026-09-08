import { ResultCard, ResultCardHeader, ResultCardImage } from 'new-gbif-org-ts';

// No network in the render environment, so remote thumbor URLs would paint as
// broken-image icons. Each cell passes an inline SVG data: URI through the
// component's real `image.file.url` prop instead — same 180x120 layout, a
// colour standing in for the photo.
const placeholder = (svg: string) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);

const newsPhoto = placeholder(
  '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120"><rect width="180" height="120" fill="#2f6b3a"/><circle cx="34" cy="96" r="48" fill="#3f8a2b" opacity="0.65"/><circle cx="156" cy="24" r="60" fill="#6fb84a" opacity="0.45"/></svg>'
);
const projectPhoto = placeholder(
  '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120"><rect width="180" height="120" fill="#274a63"/><rect x="0" y="70" width="180" height="50" fill="#3d7397" opacity="0.7"/><circle cx="140" cy="35" r="22" fill="#e9c46a"/></svg>'
);
const toolPhoto = placeholder(
  '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120"><rect width="180" height="120" fill="#4a3f6b"/><rect x="20" y="20" width="60" height="60" fill="#7a68b0" opacity="0.7"/><rect x="90" y="50" width="70" height="45" fill="#9b8ad0" opacity="0.6"/></svg>'
);

// Ported from src/routes/resource/key/news/newsResult.tsx — image sits beside
// the excerpt in a flex row, full size (no hideOnSmall).
export const NewsCardWithThumbnail = () => (
  <ResultCard.Container>
    <ResultCardHeader
      title="GBIF passes three billion occurrence records milestone"
      link="/news/8237"
      contentType="cms.contentType.news"
    />
    <div className="g-flex g-gap-4">
      <ResultCard.Content>
        The GBIF network has now mobilised more than three billion species occurrence records from
        over 2,100 publishing institutions worldwide.
      </ResultCard.Content>
      <ResultCardImage image={{ file: { url: newsPhoto } }} link="/news/8237" />
    </div>
  </ResultCard.Container>
);

// Ported from src/routes/resource/key/project/projectResult.tsx — same
// layout but with `hideOnSmall`, which the component itself only honours
// under the 550px useBelow breakpoint; at the review viewport (900px) the
// image still renders.
export const ProjectCardThumbnailHideOnSmall = () => (
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
      </ResultCard.Content>
      <ResultCardImage image={{ file: { url: projectPhoto } }} link="/project/104" hideOnSmall />
    </div>
  </ResultCard.Container>
);

// Ported from src/routes/resource/key/tool/toolResult.tsx — a shorter card
// with no metadata block, just excerpt and thumbnail.
export const ToolCardWithThumbnail = () => (
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
      <ResultCardImage image={{ file: { url: toolPhoto } }} link="/tool/57" hideOnSmall />
    </div>
  </ResultCard.Container>
);
