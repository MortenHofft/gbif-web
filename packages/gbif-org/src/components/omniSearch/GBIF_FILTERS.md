# GBIF Occurrence Search Filters

All query parameters supported by the [GBIF Occurrence Search API](https://api.gbif.org/v1/occurrence/search).
The goal is that the omni-search input box supports every filter listed here.

Where a **suggest endpoint** exists it is noted — these return prefix-matched string suggestions and accept `?q=<prefix>&limit=<n>`.
Base URL for suggest endpoints: `https://api.gbif.org/v1/occurrence/search/<field>`

---

## Taxonomic Filters

| Filter key | Description | Suggest endpoint |
|---|---|---|
| `taxonKey` | GBIF backbone taxon key — matches the taxon and all its descendants | Use taxon suggest API (e.g. `/v1/species/suggest`) |
| `acceptedTaxonKey` | Backbone key for the currently accepted taxon only | — |
| `kingdomKey` | GBIF backbone kingdom key | — |
| `phylumKey` | GBIF backbone phylum key | — |
| `classKey` | GBIF backbone class key | — |
| `orderKey` | GBIF backbone order key | — |
| `familyKey` | GBIF backbone family key | — |
| `genusKey` | GBIF backbone genus key | — |
| `subgenusKey` | GBIF backbone subgenus key | — |
| `speciesKey` | GBIF backbone species key | — |
| `scientificName` | Interpreted full scientific name of the occurrence | — |
| `verbatimScientificName` | Scientific name as provided by the source, without interpretation | — |
| `taxonId` | Verbatim identifier for the taxon (dwc:taxonID) | — |
| `taxonConceptId` | Identifier for the taxonomic concept (dwc:taxonConceptID) | — |
| `taxonomicStatus` | Status of the use of the GBIF backbone taxon key | — |
| `checklistKey` | Checklist key used for taxonomy matching | — |
| `iucnRedListCategory` | IUCN Red List category (e.g. `CR`, `EN`, `VU`) | — |

---

## Temporal Filters

| Filter key | Description | Suggest endpoint |
|---|---|---|
| `year` | 4-digit year; supports ranges, e.g. `1900,2020` or `*,1850` | — |
| `month` | Month 1–12; supports ranges | — |
| `day` | Day of month; supports ranges | — |
| `startDayOfYear` | Earliest integer day of year (1–366) | — |
| `endDayOfYear` | Latest integer day of year (1–366) | — |
| `eventDate` | Event date in ISO 8601; supports partial dates and ranges | — |
| `lastInterpreted` | Date the record was last interpreted; ISO 8601 with range support | — |
| `modified` | Date the record was last modified; ISO 8601 with range support | — |

---

## Geographic Filters

| Filter key | Description | Suggest endpoint |
|---|---|---|
| `country` | Country code (ISO 3166-1 alpha-2) the occurrence was recorded in | — |
| `publishingCountry` | Country code of the organisation that published the dataset | — |
| `continent` | Continent the occurrence was recorded in | — |
| `gbifRegion` | GBIF region derived from country | — |
| `publishedByGbifRegion` | GBIF region derived from publishing country | — |
| `decimalLatitude` | Latitude in WGS 84 (−90 to 90); supports ranges | — |
| `decimalLongitude` | Longitude in WGS 84 (−180 to 180); supports ranges | — |
| `coordinateUncertaintyInMeters` | Coordinate uncertainty in metres; supports ranges | — |
| `elevation` | Altitude/elevation in metres above sea level; supports ranges | — |
| `depth` | Depth in metres relative to altitude; supports ranges | — |
| `geometry` | Geometry in WKT format — POINT, LINESTRING, POLYGON, LINEARRING, MULTIPOLYGON | — |
| `geoDistance` | Matches within a given distance of a lat/lon point | — |
| `distanceFromCentroidInMeters` | Distance from a known centroid (e.g. country centroid) | — |
| `hasCoordinate` | `true`/`false` — filter records with or without coordinates | — |
| `hasGeospatialIssue` | `true`/`false` — include/exclude records with geospatial issues | — |
| `gadmGid` | GADM identifier at any administrative level | — |
| `gadmLevel0Gid` | GADM country/island/territory (level 0) identifier | — |
| `gadmLevel1Gid` | GADM first-level administrative identifier | — |
| `gadmLevel2Gid` | GADM second-level administrative identifier | — |
| `gadmLevel3Gid` | GADM third-level administrative identifier | — |
| `stateProvince` | Next smaller administrative region than country (verbatim) | `GET /occurrence/search/stateProvince` |
| `waterBody` | Name of the water body in which the location occurs | `GET /occurrence/search/waterBody` |
| `locality` | Specific place description | `GET /occurrence/search/locality` |
| `island` | Name of the island on or near the location | — |
| `islandGroup` | Name of the island group | — |
| `higherGeography` | Geographic names less specific than locality | — |

---

## Record & Specimen Filters

| Filter key | Description | Suggest endpoint |
|---|---|---|
| `basisOfRecord` | How the occurrence was recorded — enum: `PRESERVED_SPECIMEN`, `FOSSIL_SPECIMEN`, `LIVING_SPECIMEN`, `OBSERVATION`, `HUMAN_OBSERVATION`, `MACHINE_OBSERVATION`, `MATERIAL_SAMPLE`, `LITERATURE`, `MATERIAL_CITATION`, `OCCURRENCE`, `UNKNOWN` | — |
| `occurrenceStatus` | Occurrence status enum (e.g. `PRESENT`, `ABSENT`) | — |
| `occurrenceId` | Identifier for the occurrence (dwc:occurrenceID) | `GET /occurrence/search/occurrenceId` |
| `catalogNumber` | Identifier within a collection for the record | `GET /occurrence/search/catalogNumber` |
| `recordNumber` | Identifier given to the occurrence at time of recording | `GET /occurrence/search/recordNumber` |
| `otherCatalogNumbers` | Other catalog numbers associated with the occurrence | `GET /occurrence/search/otherCatalogNumbers` |
| `institutionCode` | Identifier for the institution holding the record | `GET /occurrence/search/institutionCode` |
| `collectionCode` | Identifier for the physical collection or digital dataset | `GET /occurrence/search/collectionCode` |
| `institutionKey` | GRSciColl institution key | — |
| `collectionKey` | GRSciColl collection key | — |
| `gbifId` | Unique GBIF key for the occurrence | — |

---

## Observer / Identifier Filters

| Filter key | Description | Suggest endpoint |
|---|---|---|
| `recordedBy` | Person who recorded the occurrence | `GET /occurrence/search/recordedBy` |
| `identifiedBy` | Person who identified the occurrence | `GET /occurrence/search/identifiedBy` |
| `recordedById` | Agent identifier (URI/ORCID) from dwc:recordedByID | — |
| `identifiedById` | Agent identifier (URI/ORCID) from dwc:identifiedByID | — |
| `georeferencedBy` | People/groups who determined the georeference | — |
| `fieldNumber` | Identifier given to the event in the field | — |

---

## Biological Filters

| Filter key | Description | Suggest endpoint |
|---|---|---|
| `lifeStage` | Life stage of the organism (GBIF vocabulary) | Use vocabulary API |
| `sex` | Sex of the biological individual(s) | — |
| `establishmentMeans` | How the organism became established at the location | — |
| `degreeOfEstablishment` | Degree to which the organism survives and expands its range | — |
| `pathway` | Process by which the organism came to be at the location | — |
| `typeStatus` | Nomenclatural type designation applied to the subject | — |
| `preparations` | Preparation methods of the occurrence | — |
| `previousIdentifications` | Previous name assignments to the organism | — |
| `associatedSequences` | Identifiers of genetic sequences associated with the material | — |
| `isSequenced` | `true`/`false` — presence of associated sequences or a sequence extension | — |
| `isInCluster` | `true`/`false` — whether the occurrence is in a cluster of related records | — |
| `organismId` | Identifier for the organism instance (dwc:organismID) | `GET /occurrence/search/organismId` |
| `iucnRedListCategory` | IUCN Red List category | — |

---

## Event Filters

| Filter key | Description | Suggest endpoint |
|---|---|---|
| `eventId` | Identifier for the Event (dwc:eventID) | `GET /occurrence/search/eventId` |
| `parentEventId` | Identifier for the broader parent Event | `GET /occurrence/search/parentEventId` |
| `samplingProtocol` | Method or protocol used during the Event | `GET /occurrence/search/samplingProtocol` |

---

## Quantitative / Sampling Filters

| Filter key | Description | Suggest endpoint |
|---|---|---|
| `organismQuantity` | Quantity of organisms (numeric or enum value) | — |
| `organismQuantityType` | Type of quantification system used | — |
| `sampleSizeValue` | Numeric size of the sample | — |
| `sampleSizeUnit` | Unit of measurement for the sample size | — |
| `relativeOrganismQuantity` | Calculated organism quantity relative to sample size | — |

---

## Dataset & Publishing Filters

| Filter key | Description | Suggest endpoint |
|---|---|---|
| `datasetKey` | Dataset UUID | — |
| `datasetId` | dwc:datasetID verbatim value | — |
| `datasetName` | dwc:datasetName verbatim value | `GET /occurrence/search/datasetName` |
| `publishingOrg` | UUID of the publishing organisation | — |
| `hostingOrganizationKey` | UUID of the organisation hosting the installation | — |
| `networkKey` | UUID of the GBIF network the publishing organisation belongs to | — |
| `installationKey` | UUID of the technical installation | — |
| `protocol` | Protocol used to provide the occurrence record | — |
| `license` | License applied to the dataset | — |
| `projectId` | GBIF project ID | — |
| `programme` | GBIF programme acronym | — |
| `crawlId` | Crawl attempt that harvested the record | — |

---

## Data Quality Filters

| Filter key | Description | Suggest endpoint |
|---|---|---|
| `issue` | Records that have a specific GBIF data quality issue flag | — |
| `taxonomicIssue` | Records that have a specific taxonomic issue flag | — |
| `mediaType` | Kind of media object: `StillImage`, `Sound`, `MovingImage` | — |
| `dwcaExtension` | Records that have a particular DwC-A extension | — |
| `repatriated` | `true`/`false` — publishing country differs from the recording country | — |

---

## Geological / Stratigraphic Filters

| Filter key | Description | Suggest endpoint |
|---|---|---|
| `geologicalTime` | Geological time — searches across all chronostratigraphy fields | — |
| `lithostratigraphy` | Searches across bed, formation, group, and member fields | — |
| `biostratigraphy` | Searches across lowest and highest biostratigraphy fields | — |
| `earliestEonOrLowestEonothem` | Earliest geochronologic eon or lowest eonothem | — |
| `latestEonOrHighestEonothem` | Latest geochronologic eon or highest eonothem | — |
| `earliestEraOrLowestErathem` | Earliest geochronologic era or lowest erathem | — |
| `latestEraOrHighestErathem` | Latest geochronologic era or highest erathem | — |
| `earliestPeriodOrLowestSystem` | Earliest geochronologic period or lowest system | — |
| `latestPeriodOrHighestSystem` | Latest geochronologic period or highest system | — |
| `earliestEpochOrLowestSeries` | Earliest geochronologic epoch or lowest series | — |
| `latestEpochOrHighestSeries` | Latest geochronologic epoch or highest series | — |
| `earliestAgeOrLowestStage` | Earliest geochronologic age or lowest stage | — |
| `latestAgeOrHighestStage` | Latest geochronologic age or highest stage | — |
| `lowestBiostratigraphicZone` | Lowest geological biostratigraphic zone | — |
| `highestBiostratigraphicZone` | Highest geological biostratigraphic zone | — |
| `group` | Full name of the lithostratigraphic group | — |
| `formation` | Full name of the lithostratigraphic formation | — |
| `member` | Full name of the lithostratigraphic member | — |
| `bed` | Full name of the lithostratigraphic bed | — |

---

## Measurement / Sequence Filters

| Filter key | Description | Suggest endpoint |
|---|---|---|
| `measurementType` | MeasurementOrFact measurementType | — |
| `measurementTypeId` | eMoF measurementTypeID | — |
| `dnaSequenceId` | DNA sequence identifier | — |

---

## Suggest Endpoints — Summary

All suggest endpoints are `GET` requests to `https://api.gbif.org/v1/occurrence/search/<field>` with `?q=<prefix>&limit=<n>`.

| Field | Endpoint path |
|---|---|
| `catalogNumber` | `/occurrence/search/catalogNumber` |
| `collectionCode` | `/occurrence/search/collectionCode` |
| `recordedBy` | `/occurrence/search/recordedBy` |
| `identifiedBy` | `/occurrence/search/identifiedBy` |
| `recordNumber` | `/occurrence/search/recordNumber` |
| `institutionCode` | `/occurrence/search/institutionCode` |
| `occurrenceId` | `/occurrence/search/occurrenceId` |
| `organismId` | `/occurrence/search/organismId` |
| `locality` | `/occurrence/search/locality` |
| `stateProvince` | `/occurrence/search/stateProvince` |
| `waterBody` | `/occurrence/search/waterBody` |
| `samplingProtocol` | `/occurrence/search/samplingProtocol` |
| `eventId` | `/occurrence/search/eventId` |
| `parentEventId` | `/occurrence/search/parentEventId` |
| `datasetName` | `/occurrence/search/datasetName` |
| `otherCatalogNumbers` | `/occurrence/search/otherCatalogNumbers` |

Filters with **controlled vocabularies** (e.g. `lifeStage`, `typeStatus`, `sex`, `establishmentMeans`, `degreeOfEstablishment`, `pathway`) can be looked up via the GBIF vocabulary API:
`GET https://api.gbif.org/v1/vocabularyConceptSearch?vocabulary=<VocabularyName>&q=<prefix>`

Filters backed by the **GBIF backbone taxonomy** (`taxonKey` and rank-specific keys) should use the species suggest API:
`GET https://api.gbif.org/v1/species/suggest?q=<prefix>`
