import { ResultCard, ResultCardHeader, ResultCardTag } from 'new-gbif-org-ts';

// Ported from src/routes/resource/key/news/newsResult.tsx — a CMS "News" result
// card: header with content-type tag, excerpt beside a thumbnail, and a
// published-date footer inside the metadata slot.
export const NewsArticleCard = () => (
  <ResultCard.Container dir="ltr">
    <ResultCardHeader
      title="GBIF passes three billion occurrence records milestone"
      link="/news/8237"
      contentType="cms.contentType.news"
    />
    <div className="g-flex g-gap-4">
      <ResultCard.Content>
        The GBIF network has now mobilised more than three billion species occurrence records from
        over 2,100 publishing institutions worldwide, a milestone reached largely thanks to
        automated ingestion of citizen-science observations.
        <ResultCard.Metadata className="g-flex g-items-center">
          Published 3 September 2026
        </ResultCard.Metadata>
      </ResultCard.Content>
      <div className="g-flex-none">
        <img
          width={180}
          height={120}
          className="g-border g-border-solid g-border-slate-200/50 g-rounded g-w-[180px] g-h-[120px]"
          src={
            'data:image/svg+xml;utf8,' +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120"><rect width="180" height="120" fill="#2f6b3a"/><circle cx="34" cy="96" r="48" fill="#3f8a2b" opacity="0.65"/><circle cx="156" cy="24" r="60" fill="#6fb84a" opacity="0.45"/></svg>'
            )
          }
        />
      </div>
    </div>
  </ResultCard.Container>
);

// Ported from src/routes/resource/key/project/projectResult.tsx — programme
// link plus clickable purpose tags in the metadata slot, demonstrating the
// container hosting a denser, filterable composition.
export const ProjectWithPurposeTagsCard = () => (
  <ResultCard.Container dir="ltr">
    <ResultCardHeader
      title="Mobilising biodiversity data from Nordic natural history collections"
      link="/project/104"
      contentType="cms.contentType.project"
    />
    <ResultCard.Content>
      A two-year project digitising and publishing specimen records held by natural history
      museums in Denmark, Norway and Sweden, funded under the GBIF Biodiversity Information for
      Development programme.
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
            <span>Capacity enhancement</span>
          </ResultCardTag>
        </div>
      </ResultCard.Metadata>
    </ResultCard.Content>
  </ResultCard.Container>
);

// dir="rtl" exercises the container's logical-property styling (the same
// prop networkResult.tsx / projectResult.tsx derive from getTextDirection for
// Arabic-titled CMS content) — no image, text-only excerpt.
export const RtlNetworkCard = () => (
  <ResultCard.Container dir="rtl">
    <ResultCardHeader
      title="مرصد التنوع البيولوجي الإقليمي"
      link="/network/22"
      contentType="cms.contentType.network"
    />
    <ResultCard.Content>
      شبكة إقليمية لناشري بيانات التنوع البيولوجي تعمل على تجميع سجلات الحدوث من المؤسسات
      البحثية والحدائق النباتية.
    </ResultCard.Content>
  </ResultCard.Container>
);
