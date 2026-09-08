import { Properties, Property, PropertyLabel, Term, Value } from 'new-gbif-org-ts';

// Field labels come from the real translation dictionary via `labelId`, exactly
// as the occurrence and collection pages use them.
export const OccurrenceRecord = () => (
  <Properties useDefaultTermWidths>
    <Property labelId="occurrenceFieldNames.datasetName" value="iNaturalist Research-grade Observations" />
    <Property labelId="occurrenceFieldNames.basisOfRecord" value="Human observation" />
    <Property labelId="occurrenceFieldNames.recordedBy" value="Malay Mehta" />
    <Property labelId="occurrenceFieldNames.catalogNumber" value="OBS-2024-114872" />
    <Property labelId="occurrenceFieldNames.eventDate" value="23 April 2024" />
  </Properties>
);

export const Vertical = () => (
  <Properties horizontal={false}>
    <Property labelId="occurrenceFieldNames.country" value="Australia" />
    <Property labelId="occurrenceFieldNames.locality" value="Cleland Conservation Park, South Australia" />
    <Property labelId="occurrenceFieldNames.elevation" value={512} />
  </Properties>
);

// Arrays render as a bullet list; numbers go through FormattedNumber.
export const MultiValueAndNumbers = () => (
  <Properties useDefaultTermWidths>
    <Property
      labelId="occurrenceFieldNames.identifiedBy"
      value={['Duméril, A. M. C.', 'Bibron, G.', 'Reviewed by iNaturalist community']}
    />
    <Property labelId="occurrenceFieldNames.individualCount" value={3} />
    <Property labelId="occurrenceFieldNames.coordinateUncertaintyInMeters" value={28762} />
    <Property
      labelId="occurrenceFieldNames.occurrenceID"
      value="https://www.inaturalist.org/observations/205488213"
      formatter={(v) => (
        <a className="g-underline" href={v}>
          {v}
        </a>
      )}
    />
  </Properties>
);

// showEmpty keeps the row and renders the EmptyValue marker instead of hiding it.
export const EmptyValues = () => (
  <Properties useDefaultTermWidths>
    <Property labelId="occurrenceFieldNames.sex" value={undefined} showEmpty />
    <Property labelId="occurrenceFieldNames.lifeStage" value={null} showEmpty />
    <Property labelId="occurrenceFieldNames.datasetName" value="Naturalis Biodiversity Center" />
  </Properties>
);

// Term/Value compose the same rows without going through the intl dictionary.
export const TermAndValue = () => (
  <Properties useDefaultTermWidths>
    <Term>
      <PropertyLabel titleId="occurrenceFieldNames.scientificName" />
    </Term>
    <Value>Ctenophorus decresii (Duméril &amp; Bibron, 1837)</Value>
    <Term>Kingdom</Term>
    <Value>Animalia</Value>
    <Term>Taxon ID</Term>
    <Value>31242</Value>
  </Properties>
);
