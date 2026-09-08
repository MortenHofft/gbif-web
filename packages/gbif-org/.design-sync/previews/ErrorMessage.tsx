import { ErrorMessage } from 'new-gbif-org-ts';

// Ported from src/routes/dataset/key/about.tsx (and repeated verbatim in the
// institution and taxon map views) — shown when a map tile layer fails to
// load.
export const MapLoadFailure = () => <ErrorMessage className="g-mb-4">Unable to load map</ErrorMessage>;

// Ported from src/routes/publisher/key/publisherKey.tsx — a short single-word
// status message with no surrounding markup.
export const PublisherNotEndorsed = () => <ErrorMessage>Not yet endorsed</ErrorMessage>;

// Ported from src/routes/occurrence/download/key/sections/subHeader.tsx — a
// longer message with an inline mailto link, shown when a download's archive
// file has been erased from storage.
export const DownloadFileDeletedWithContact = () => (
  <ErrorMessage className="g-mt-4">
    <span className="g-me-1">
      This file has been deleted. You can still access all metadata of the original query and
      rerun the same query on data currently available.
    </span>
    <a href="mailto:helpdesk@gbif.org" className="g-underline g-text-inherit">
      Contact help desk
    </a>
  </ErrorMessage>
);
