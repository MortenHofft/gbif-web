import { GenericFeature, Classification } from 'new-gbif-org-ts';
import { MdGridOn, MdLink } from 'react-icons/md';
import { GiDna1 } from 'react-icons/gi';
import { FaGlobeAfrica } from 'react-icons/fa';

// The icon+text feature rows shown on an occurrence page's header, e.g.
// coordinates, sampling event and sequenced flags (see
// src/routes/occurrence/key/occurrenceKey.tsx lines ~700-820).

export const Coordinates = () => (
  <GenericFeature>
    <FaGlobeAfrica />
    -35.02389, 138.0102 (uncertainty: 750m)
  </GenericFeature>
);

export const SamplingEvent = () => (
  <GenericFeature>
    <MdGridOn /> <span>Sampling event</span>
  </GenericFeature>
);

export const Sequenced = () => (
  <GenericFeature>
    <GiDna1 /> <span>Sequenced</span>
  </GenericFeature>
);

export const CountryAndLocality = () => (
  <GenericFeature className="g-flex g-mb-1">
    <FaGlobeAfrica />
    <Classification className="g-inline-block g-me-2" dir="auto">
      <span>Australia</span>
      <span>South Australia</span>
      <span>Kangaroo Island</span>
    </Classification>
  </GenericFeature>
);

export const HomepageLink = () => (
  <GenericFeature>
    <MdLink />
    <span>www.ala.org.au</span>
  </GenericFeature>
);
