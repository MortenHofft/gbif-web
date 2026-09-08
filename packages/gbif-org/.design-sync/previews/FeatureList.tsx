import {
  Coordinates,
  FeatureList,
  GenericFeature,
  Homepage,
  IIIF,
  Location,
  SamplingEvent,
  Sequenced,
} from 'new-gbif-org-ts';
import { MdPeople } from 'react-icons/md';

// FeatureList is the flex-wrap row that lays out GenericFeature (and its
// specialised siblings) side by side — see the occurrence page header at
// src/routes/occurrence/key/occurrenceKey.tsx lines ~813-823 and the dataset
// header contacts/homepage row at src/routes/dataset/key/datasetKey.tsx. The
// individual feature rows already have their own preview
// (.design-sync/previews/GenericFeature.tsx); these cells exist to show the
// container actually wrapping several of them together.

// Ported from occurrenceKey.tsx: sampling event + sequenced flags, a homepage
// link and an IIIF logo link, wrapping onto one row.
export const OccurrenceHeaderFeatures = () => (
  <FeatureList>
    <SamplingEvent />
    <Sequenced />
    <Homepage url="www.ala.org.au" />
    <IIIF url="https://ids.biodiversity.org.au/iiif/v3" />
  </FeatureList>
);

// Location + free-text coordinates, as shown together on an occurrence
// record's header (src/routes/occurrence/key/occurrenceKey.tsx uses
// `Location` for the country/locality classification alongside `Coordinates`
// for the lat/long string).
export const LocationAndCoordinates = () => (
  <FeatureList>
    <Location countryCode="AU" city="Adelaide" locality="Kangaroo Island" />
    <Coordinates str="-35.02389, 138.0102 (uncertainty: 750m)" />
  </FeatureList>
);

// Ported from datasetKey.tsx's header info row: a contacts count next to the
// publisher's homepage link.
export const DatasetContactsAndHomepage = () => (
  <FeatureList>
    <GenericFeature>
      <MdPeople /> <span>12 contacts</span>
    </GenericFeature>
    <Homepage url="www.gbif.se" />
  </FeatureList>
);
