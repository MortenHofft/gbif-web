import { DataHeader } from 'new-gbif-org-ts';

// The thin bar that sits above every search and key page: catalogue selector on
// the left, page title in the middle, and the DOI / about / API affordances on
// the right. Ported from src/routes/collection/search/collectionSearch.tsx and
// src/routes/dataset/key/datasetKey.tsx.
//
// Text is passed as plain strings rather than <FormattedMessage>: a preview file
// that imports react-intl directly gets a SECOND copy of the library, whose
// context does not cross the bundle boundary. Strings inside the bundle's own
// components still resolve through the real dictionary.

const AboutContent = () => (
  <div className="g-text-sm">
    Collections registered in GBIF, including those that have not yet published
    occurrence records.
  </div>
);

const ApiContent = () => (
  <div className="g-text-sm">
    <p className="g-mb-2">This page is built with the public GBIF API.</p>
    <code className="g-text-xs">GET /v1/grscicoll/collection?q=herbarium</code>
  </div>
);

export const OccurrenceSearchHeader = () => (
  <DataHeader
    className="g-bg-white"
    hasBorder
    title="Occurrences"
    aboutContent={<AboutContent />}
    apiContent={<ApiContent />}
  />
);

export const DatasetKeyHeader = () => (
  <DataHeader
    className="g-bg-white"
    hasBorder
    doi="10.48580/dgykv"
    aboutContent={<AboutContent />}
    apiContent={<ApiContent />}
  />
);

export const DownloadHeader = () => (
  <DataHeader className="g-bg-white" hasBorder title="Download" doi="10.15468/dl.abc123" />
);

// Tool and validation-report pages hide the catalogue selector entirely.
export const ToolHeader = () => (
  <DataHeader
    className="g-bg-white"
    hasBorder
    hideCatalogueSelector
    title="Data validator"
    apiContent={<ApiContent />}
  />
);
