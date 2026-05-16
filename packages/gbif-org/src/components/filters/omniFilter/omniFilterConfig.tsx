import { SuggestConfig } from '@/utils/suggestEndpoints';
import {
  basisOfRecordConfig,
  continentConfig,
  dwcaExtensionConfig,
  gbifRegionConfig,
  iucnRedListCategoryConfig,
  licenceConfig,
  mediaTypeConfig,
  monthConfig,
  occurrenceIssueConfig,
  occurrenceStatusConfig,
  occurrenceTaxonomicIssueConfig,
  protocolConfig,
  publishedByGbifRegionConfig,
} from '@/routes/occurrence/search/filters/enums';
import {
  collectionCodeConfig,
  collectionKeyConfig,
  datasetKeyConfig,
  gadmGidConfig,
  hostingOrganizationKeyConfig,
  institutionCodeConfig,
  institutionKeyConfig,
  networkKeyConfig,
  publishingOrgConfig,
  recordNumberConfig,
  taxonKeyConfig,
  typeStatusSuggestConfig,
} from '@/routes/occurrence/search/filters/keySuggest';
import {
  degreeOfEstablishmentConfig,
  establishmentMeansConfig,
  lifeStageConfig,
  pathwayConfig,
  sexConfig,
} from '@/routes/occurrence/search/filters/vocabulary';

// Per-filter omni-search metadata. Looked up by filter handle.
// Each entry describes how to fetch value suggestions and how to render the value chip.
// The actual filter name translation comes from the existing `filters` map.

export type OmniValueKind =
  | { kind: 'enum'; options: string[]; enumTemplate?: (value: string) => string }
  | { kind: 'optionalBool' }
  | { kind: 'suggest'; suggestConfig: SuggestConfig; supportsLike?: boolean }
  | { kind: 'taxon'; suggestConfig: SuggestConfig }
  | { kind: 'wildcard' } // string with optional ?, * wildcard characters
  | { kind: 'range' } // numeric range like "100,200" or "100"
  | { kind: 'geologicalTime' }
  | { kind: 'freeText' } // q
  | { kind: 'country' }; // country/publishingCountry — uses useCountrySuggest

export type OmniFieldConfig = {
  handle: string;
  value: OmniValueKind;
  // Template for translating enum values; the underlying gbif-web displayName
  // components do this via FormattedMessage with paths like enums.basisOfRecord.<value>.
  // We surface the template here so the dropdown can show translated labels.
};

const enumField = (handle: string, options: string[], enumName: string): OmniFieldConfig => ({
  handle,
  value: {
    kind: 'enum',
    options,
    enumTemplate: (value: string) => `enums.${enumName}.${value}`,
  },
});

export const OMNI_FILTER_CONFIG: Record<string, OmniFieldConfig> = {
  // ── Free text ──────────────────────────────────────────────────────────────
  q: { handle: 'q', value: { kind: 'freeText' } },

  // ── Enums ──────────────────────────────────────────────────────────────────
  basisOfRecord: enumField('basisOfRecord', basisOfRecordConfig.options ?? [], 'basisOfRecord'),
  mediaType: enumField('mediaType', mediaTypeConfig.options ?? [], 'mediaType'),
  month: enumField('month', monthConfig.options ?? [], 'month'),
  continent: enumField('continent', continentConfig.options ?? [], 'continent'),
  protocol: enumField('protocol', protocolConfig.options ?? [], 'endpointType'),
  dwcaExtension: enumField('dwcaExtension', dwcaExtensionConfig.options ?? [], 'dwcaExtension'),
  iucnRedListCategory: enumField('iucnRedListCategory', iucnRedListCategoryConfig.options ?? [], 'iucnRedListCategory'),
  license: enumField('license', licenceConfig.options ?? [], 'license'),
  occurrenceStatus: enumField('occurrenceStatus', occurrenceStatusConfig.options ?? [], 'occurrenceStatus'),
  issue: enumField('issue', occurrenceIssueConfig.options ?? [], 'occurrenceIssue'),
  taxonomicIssue: enumField('taxonomicIssue', occurrenceTaxonomicIssueConfig.options ?? [], 'taxonIssue'),
  gbifRegion: enumField('gbifRegion', gbifRegionConfig.options ?? [], 'gbifRegion'),
  publishedByGbifRegion: enumField(
    'publishedByGbifRegion',
    publishedByGbifRegionConfig.options ?? [],
    'gbifRegion'
  ),

  // ── Booleans ───────────────────────────────────────────────────────────────
  isInCluster: { handle: 'isInCluster', value: { kind: 'optionalBool' } },
  isSequenced: { handle: 'isSequenced', value: { kind: 'optionalBool' } },
  repatriated: { handle: 'repatriated', value: { kind: 'optionalBool' } },
  hasCoordinate: { handle: 'hasCoordinate', value: { kind: 'optionalBool' } },
  hasGeospatialIssue: { handle: 'hasGeospatialIssue', value: { kind: 'optionalBool' } },

  // ── Suggest (entity key) ──────────────────────────────────────────────────
  taxonKey: { handle: 'taxonKey', value: { kind: 'taxon', suggestConfig: taxonKeyConfig.suggestConfig! } },
  datasetKey: { handle: 'datasetKey', value: { kind: 'suggest', suggestConfig: datasetKeyConfig.suggestConfig! } },
  publishingOrg: { handle: 'publishingOrg', value: { kind: 'suggest', suggestConfig: publishingOrgConfig.suggestConfig! } },
  hostingOrganizationKey: {
    handle: 'hostingOrganizationKey',
    value: { kind: 'suggest', suggestConfig: hostingOrganizationKeyConfig.suggestConfig! },
  },
  networkKey: { handle: 'networkKey', value: { kind: 'suggest', suggestConfig: networkKeyConfig.suggestConfig! } },
  institutionKey: {
    handle: 'institutionKey',
    value: { kind: 'suggest', suggestConfig: institutionKeyConfig.suggestConfig! },
  },
  collectionKey: {
    handle: 'collectionKey',
    value: { kind: 'suggest', suggestConfig: collectionKeyConfig.suggestConfig! },
  },
  gadmGid: { handle: 'gadmGid', value: { kind: 'suggest', suggestConfig: gadmGidConfig.suggestConfig! } },
  institutionCode: {
    handle: 'institutionCode',
    value: { kind: 'suggest', suggestConfig: institutionCodeConfig.suggestConfig! },
  },
  collectionCode: {
    handle: 'collectionCode',
    value: { kind: 'suggest', suggestConfig: collectionCodeConfig.suggestConfig! },
  },
  recordNumber: { handle: 'recordNumber', value: { kind: 'suggest', suggestConfig: recordNumberConfig.suggestConfig! } },
  typeStatus: { handle: 'typeStatus', value: { kind: 'suggest', suggestConfig: typeStatusSuggestConfig.suggestConfig! } },
  establishmentMeans: {
    handle: 'establishmentMeans',
    value: { kind: 'suggest', suggestConfig: establishmentMeansConfig.suggestConfig! },
  },
  degreeOfEstablishment: {
    handle: 'degreeOfEstablishment',
    value: { kind: 'suggest', suggestConfig: degreeOfEstablishmentConfig.suggestConfig! },
  },
  pathway: { handle: 'pathway', value: { kind: 'suggest', suggestConfig: pathwayConfig.suggestConfig! } },
  lifeStage: { handle: 'lifeStage', value: { kind: 'suggest', suggestConfig: lifeStageConfig.suggestConfig! } },
  sex: { handle: 'sex', value: { kind: 'suggest', suggestConfig: sexConfig.suggestConfig! } },

  // ── Country (special — needs translated client-side suggestions) ──────────
  country: { handle: 'country', value: { kind: 'country' } },
  publishingCountry: { handle: 'publishingCountry', value: { kind: 'country' } },

  // ── Wildcard (LIKE) ───────────────────────────────────────────────────────
  catalogNumber: { handle: 'catalogNumber', value: { kind: 'wildcard' } },
  locality: { handle: 'locality', value: { kind: 'wildcard' } },
  waterBody: { handle: 'waterBody', value: { kind: 'wildcard' } },
  stateProvince: { handle: 'stateProvince', value: { kind: 'wildcard' } },
  samplingProtocol: { handle: 'samplingProtocol', value: { kind: 'wildcard' } },
  verbatimScientificName: { handle: 'verbatimScientificName', value: { kind: 'wildcard' } },
  recordedBy: { handle: 'recordedBy', value: { kind: 'wildcard' } },
  identifiedBy: { handle: 'identifiedBy', value: { kind: 'wildcard' } },
  georeferencedBy: { handle: 'georeferencedBy', value: { kind: 'wildcard' } },
  preparations: { handle: 'preparations', value: { kind: 'wildcard' } },
  biostratigraphy: { handle: 'biostratigraphy', value: { kind: 'wildcard' } },
  lithostratigraphy: { handle: 'lithostratigraphy', value: { kind: 'wildcard' } },
  sampleSizeUnit: { handle: 'sampleSizeUnit', value: { kind: 'wildcard' } },
  islandGroup: { handle: 'islandGroup', value: { kind: 'wildcard' } },
  island: { handle: 'island', value: { kind: 'wildcard' } },
  datasetId: { handle: 'datasetId', value: { kind: 'wildcard' } },
  organismQuantityType: { handle: 'organismQuantityType', value: { kind: 'wildcard' } },

  // ── Plain text fields (no wildcards — match exactly) ─────────────────────
  projectId: { handle: 'projectId', value: { kind: 'wildcard' } },
  recordedById: { handle: 'recordedById', value: { kind: 'wildcard' } },
  identifiedById: { handle: 'identifiedById', value: { kind: 'wildcard' } },
  occurrenceId: { handle: 'occurrenceId', value: { kind: 'wildcard' } },
  organismId: { handle: 'organismId', value: { kind: 'wildcard' } },
  higherGeography: { handle: 'higherGeography', value: { kind: 'wildcard' } },
  eventId: { handle: 'eventId', value: { kind: 'wildcard' } },
  fieldNumber: { handle: 'fieldNumber', value: { kind: 'wildcard' } },
  taxonId: { handle: 'taxonId', value: { kind: 'wildcard' } },
  datasetName: { handle: 'datasetName', value: { kind: 'wildcard' } },
  programme: { handle: 'programme', value: { kind: 'wildcard' } },
  gbifId: { handle: 'gbifId', value: { kind: 'wildcard' } },
  previousIdentifications: { handle: 'previousIdentifications', value: { kind: 'wildcard' } },
  associatedSequences: { handle: 'associatedSequences', value: { kind: 'wildcard' } },

  // ── Numeric ranges ────────────────────────────────────────────────────────
  year: { handle: 'year', value: { kind: 'range' } },
  coordinateUncertaintyInMeters: { handle: 'coordinateUncertaintyInMeters', value: { kind: 'range' } },
  depth: { handle: 'depth', value: { kind: 'range' } },
  organismQuantity: { handle: 'organismQuantity', value: { kind: 'range' } },
  relativeOrganismQuantity: { handle: 'relativeOrganismQuantity', value: { kind: 'range' } },
  sampleSizeValue: { handle: 'sampleSizeValue', value: { kind: 'range' } },
  elevation: { handle: 'elevation', value: { kind: 'range' } },
  distanceFromCentroidInMeters: { handle: 'distanceFromCentroidInMeters', value: { kind: 'range' } },
  startDayOfYear: { handle: 'startDayOfYear', value: { kind: 'range' } },
  endDayOfYear: { handle: 'endDayOfYear', value: { kind: 'range' } },

  // ── Geological time (vocabulary-backed range) ────────────────────────────
  geologicalTime: { handle: 'geologicalTime', value: { kind: 'geologicalTime' } },
};
