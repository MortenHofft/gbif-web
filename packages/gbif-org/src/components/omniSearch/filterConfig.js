export const GBIF_GRAPHQL_URL = 'https://graphql.gbif.org/graphql';
const GBIF_SUGGEST_BASE = 'https://api.gbif.org/v1/occurrence/search';

// Fetch a single entity from the GBIF REST API and return its display title.
const resolveGbifEntity = (apiPath, titleProp = 'title') => async value => {
  try {
    const res = await fetch(`https://api.gbif.org/v1/${apiPath}/${encodeURIComponent(value)}`);
    if (!res.ok) return value;
    const d = await res.json();
    return d[titleProp] ?? d.title ?? d.name ?? value;
  } catch {
    return value;
  }
};

export function formatRangeLabel(value) {
  if (!value || value === '*') return 'has any value';
  const parts = value.split(',');
  if (parts.length === 2) {
    const [from, to] = parts.map(p => p.trim());
    if (from === '*' && to)   return `up to ${to}`;
    if (to   === '*' && from) return `from ${from}`;
    if (from && to)           return `${from} – ${to}`;
  }
  return value;
}

// Commas and * are meaningful in range values — don't percent-encode them.
const encodeRangeValue = value =>
  value.split(',').map(v => (v === '*' ? '*' : encodeURIComponent(v))).join(',');

const rangeField = (key, label, hint, presets) => ({
  key, label, hint,
  type: 'integerRange',
  formatValue: formatRangeLabel,
  encodeValue: encodeRangeValue,
  ...(presets && { presets }),
});

// "Last N years" anchors on today rather than module-load time, so the
// dropdown stays correct in a long-lived session that crosses midnight on
// Dec 31. Trailing window is N-1 + this year (inclusive) so "Last 5 years"
// covers the current calendar year plus the four preceding ones.
const yearPresets = () => {
  const y = new Date().getFullYear();
  const span = n => `${y - (n - 1)},${y}`;
  return [
    { value: `${y}`,     label: 'This year',     meta: `${y}` },
    { value: `${y - 1}`, label: 'Last year',     meta: `${y - 1}` },
    { value: span(5),    label: 'Last 5 years',  meta: span(5) },
    { value: span(10),   label: 'Last 10 years', meta: span(10) },
    { value: span(25),   label: 'Last 25 years', meta: span(25) },
    { value: span(50),   label: 'Last 50 years', meta: span(50) },
  ];
};

const elevationPresets = [
  { value: '*,0',    label: 'Below sea level',  meta: '*,0' },
  { value: '0,500',  label: 'Up to 500 m',      meta: '0,500' },
  { value: '0,1000', label: 'Up to 1 000 m',    meta: '0,1000' },
  { value: '500,*',  label: 'Above 500 m',      meta: '500,*' },
  { value: '1000,*', label: 'Above 1 000 m',    meta: '1000,*' },
  { value: '2000,*', label: 'Above 2 000 m',    meta: '2000,*' },
];

const depthPresets = [
  { value: '0,200',     label: 'Epipelagic (0–200 m)',         meta: '0,200' },
  { value: '200,1000',  label: 'Mesopelagic (200–1 000 m)',    meta: '200,1000' },
  { value: '1000,4000', label: 'Bathypelagic (1 000–4 000 m)', meta: '1000,4000' },
  { value: '4000,*',    label: 'Abyssal (below 4 000 m)',      meta: '4000,*' },
];

const suggestField = (key, label, hint, wildcardPattern = false) => ({
  key, label, hint,
  type: 'suggestString',
  suggestUrl: `${GBIF_SUGGEST_BASE}/${key}`,
  ...(wildcardPattern && { wildcardPattern: true }),
});

const vocabField = (key, label, hint, vocabulary, limit = 10) => ({
  key, label, hint,
  type: 'vocabulary',
  vocabulary,
  limit,
});

const booleanField = (key, label, hint) => ({ key, label, hint, type: 'boolean' });

const geoTimeField = (key, label, hint) => ({
  key, label, hint,
  type: 'geoTimeRange',
  formatValue: formatRangeLabel,
  encodeValue: encodeRangeValue,
});

/**
 * Filter type reference:
 *
 *   freeText          – unstructured text; typed value becomes the filter value
 *   boolean           – true / false (+ wildcard for "has any value")
 *   enum              – static list of string values (cfg.values)
 *   integerRange      – single integer or "low,high" range; * = wildcard
 *   suggestString     – live prefix-match endpoint returning string[]
 *   suggestStringRange– live prefix-match endpoint returning string[]; values
 *                       may be a single name OR a "name,name" / "*,name" range
 *   geoTimeRange      – GBIF geological-time vocabulary; values may be a single
 *                       period name OR a "from,to" range, with the range
 *                       validated against the periods' startAge / endAge so
 *                       "to" cannot begin before "from" ends
 *   suggestEntity     – live prefix-match endpoint returning objects;
 *                       cfg.toSuggestion maps each object to { value, label, meta }
 *   vocabulary        – GBIF vocabulary GraphQL endpoint (cfg.vocabulary, cfg.limit)
 */
export const FILTER_CONFIG = [

  // ── Full-text ──────────────────────────────────────────────────────────────
  {
    key: 'q',
    label: 'Text Search',
    hint: 'Free-text search across all indexed fields',
    type: 'freeText',
    formatValue: v => `"${v}"`,
  },

  // ── Taxon ──────────────────────────────────────────────────────────────────
  {
    key: 'taxonKey',
    label: 'Taxon',
    aliases: ['Scientific name', 'Species'],
    hint: 'Search by species name',
    type: 'suggestEntity',
    suggestUrl: 'https://api.gbif.org/v2/experimental/taxon/suggest/7ddf754f-d193-4cc9-b351-99906754a03b',
    toSuggestion: item => ({
      value: item.taxonID ?? String(item.key ?? item.id ?? ''),
      label: item.scientificName ?? item.canonicalName ?? item.name ?? item.taxonID,
      meta:  [item.taxonRank, item.context].filter(Boolean).join(' · ') || null,
    }),
    // Resolve a stored taxon key back to a display name on page load.
    // Falls back to the raw value if the key is not a plain GBIF integer key.
    resolveLabel: async value => {
      if (!/^\d+$/.test(value)) return value;
      return resolveGbifEntity('species', 'scientificName')(value);
    },
  },

  // ── Record type ────────────────────────────────────────────────────────────
  {
    key: 'basisOfRecord',
    label: 'Basis of Record',
    hint: 'How the occurrence was recorded',
    type: 'enum',
    values: [
      'PRESERVED_SPECIMEN', 'FOSSIL_SPECIMEN', 'LIVING_SPECIMEN',
      'OBSERVATION', 'HUMAN_OBSERVATION', 'MACHINE_OBSERVATION',
      'MATERIAL_SAMPLE', 'LITERATURE', 'MATERIAL_CITATION', 'OCCURRENCE', 'UNKNOWN',
    ],
  },
  {
    key: 'occurrenceStatus',
    label: 'Occurrence Status',
    hint: 'Whether the organism was present or absent',
    type: 'enum',
    values: ['PRESENT', 'ABSENT'],
  },
  {
    key: 'mediaType',
    label: 'Media Type',
    hint: 'Kind of media object attached to the record',
    type: 'enum',
    values: ['StillImage', 'Sound', 'MovingImage'],
  },
  {
    key: 'continent',
    label: 'Continent',
    hint: 'Continent the occurrence was recorded in',
    type: 'enum',
    values: ['AFRICA', 'ANTARCTICA', 'ASIA', 'EUROPE', 'NORTH_AMERICA', 'OCEANIA', 'SOUTH_AMERICA'],
  },

  // ── Temporal ───────────────────────────────────────────────────────────────
  rangeField('year',           'Year',              'Single year or range, e.g. 1900,2000', yearPresets),
  rangeField('month',          'Month',             'Month 1–12, or range e.g. 3,8'),
  rangeField('day',            'Day',               'Day of month 1–31, or range'),
  rangeField('startDayOfYear', 'Start Day of Year', 'Earliest integer day of year (1–366)'),
  rangeField('endDayOfYear',   'End Day of Year',   'Latest integer day of year (1–366)'),

  // ── Geography ──────────────────────────────────────────────────────────────
  rangeField('elevation', 'Elevation', 'Altitude in metres above sea level, or range', elevationPresets),
  rangeField('depth',     'Depth',     'Depth in metres below surface, or range',      depthPresets),
  {
    key: 'gadmGid',
    label: 'Administrative Area',
    hint: 'GADM administrative unit (country, region, or sub-region)',
    type: 'suggestEntity',
    suggestUrl: 'https://api.gbif.org/v1/geocode/gadm/search',
    toSuggestion: item => {
      const name    = item.name ?? String(item.id ?? '');
      const parents = Array.isArray(item.higherRegions)
        ? [...item.higherRegions].reverse().map(p => p.name).filter(Boolean)
        : [];
      const hierarchy = parents.length ? parents.join(' · ') : null;
      return {
        value:     String(item.id ?? name),
        label:     name,
        meta:      hierarchy,
        chipLabel: hierarchy ? `${name} · ${hierarchy}` : name,
      };
    },
    resolveLabel: async value => {
      try {
        const res = await fetch(`https://api.gbif.org/v1/geocode/gadm/${encodeURIComponent(value)}`);
        if (!res.ok) return value;
        const d = await res.json();
        const name = d.name ?? value;
        const parents = Array.isArray(d.higherRegions)
          ? [...d.higherRegions].reverse().map(p => p.name).filter(Boolean)
          : [];
        return parents.length ? `${name} · ${parents.join(' · ')}` : name;
      } catch {
        return value;
      }
    },
  },
  suggestField('stateProvince', 'State / Province', 'Sub-national administrative region · supports ? and * wildcard patterns', true),
  suggestField('waterBody',     'Water Body',       'Name of the water body · supports ? and * wildcard patterns', true),
  suggestField('locality',      'Locality',         'Specific place description'),

  // ── Observer ───────────────────────────────────────────────────────────────
  suggestField('recordedBy',   'Recorded By',   'Collector or observer name · supports ? and * wildcard patterns', true),
  suggestField('identifiedBy', 'Identified By', 'Person who identified the organism · supports ? and * wildcard patterns', true),

  // ── Collection ─────────────────────────────────────────────────────────────
  suggestField('catalogNumber',       'Catalog Number',        'Collection catalog number'),
  suggestField('collectionCode',      'Collection Code',       'Physical collection or dataset identifier'),
  suggestField('recordNumber',        'Record Number',         'Identifier given at time of recording'),
  suggestField('institutionCode',     'Institution Code',      'Institution holding the record'),
  suggestField('occurrenceId',        'Occurrence ID',         'Occurrence identifier (dwc:occurrenceID)'),
  suggestField('otherCatalogNumbers', 'Other Catalog Numbers', 'Additional catalog numbers'),
  suggestField('datasetName',         'Dataset Name',          'Dataset name (dwc:datasetName)'),
  suggestField('organismId',          'Organism ID',           'Organism instance identifier (dwc:organismID)'),

  // ── Event ──────────────────────────────────────────────────────────────────
  suggestField('samplingProtocol', 'Sampling Protocol', 'Method or protocol used during the event'),
  suggestField('eventId',          'Event ID',          'Event identifier (dwc:eventID)'),
  suggestField('parentEventId',    'Parent Event ID',   'Broader parent event identifier'),

  // ── Dataset & publisher ────────────────────────────────────────────────────
  {
    key: 'datasetKey',
    label: 'Dataset',
    hint: 'Dataset the occurrence belongs to',
    type: 'suggestEntity',
    suggestUrl: 'https://api.gbif.org/v1/dataset/suggest',
    toSuggestion: item => ({
      value: String(item.key),
      label: item.title ?? String(item.key),
      meta:  item.type ?? null,
    }),
    resolveLabel: resolveGbifEntity('dataset'),
  },
  {
    key: 'publishingOrg',
    label: 'Publisher',
    hint: 'Organisation that published the dataset',
    type: 'suggestEntity',
    suggestUrl: 'https://api.gbif.org/v1/organization/suggest',
    toSuggestion: item => ({
      value: String(item.key),
      label: item.title ?? item.name ?? String(item.key),
      meta:  null,
    }),
    resolveLabel: resolveGbifEntity('organization'),
  },
  {
    key: 'hostingOrganizationKey',
    label: 'Hosting Organisation',
    hint: 'Organisation hosting the installation that serves the data',
    type: 'suggestEntity',
    suggestUrl: 'https://api.gbif.org/v1/organization/suggest',
    toSuggestion: item => ({
      value: String(item.key),
      label: item.title ?? item.name ?? String(item.key),
      meta:  null,
    }),
    resolveLabel: resolveGbifEntity('organization'),
  },
  {
    key: 'networkKey',
    label: 'Network',
    hint: 'GBIF network the publishing organisation belongs to',
    type: 'suggestEntity',
    suggestUrl: 'https://api.gbif.org/v1/network/suggest',
    toSuggestion: item => ({
      value: String(item.key),
      label: item.title ?? item.name ?? String(item.key),
      meta:  null,
    }),
    resolveLabel: resolveGbifEntity('network'),
  },
  {
    key: 'installationKey',
    label: 'Installation',
    hint: 'Technical installation that hosts this record',
    type: 'suggestEntity',
    suggestUrl: 'https://api.gbif.org/v1/installation/suggest',
    toSuggestion: item => ({
      value: String(item.key),
      label: item.title ?? item.name ?? String(item.key),
      meta:  null,
    }),
    resolveLabel: resolveGbifEntity('installation'),
  },

  // ── Biological ────────────────────────────────────────────────────────────
  vocabField('lifeStage',             'Life Stage',              'Developmental stage of organism',                   'LifeStage'),
  vocabField('typeStatus',            'Type Status',             'Nomenclatural type designation',                    'TypeStatus', 20),
  vocabField('sex',                   'Sex',                     'Sex of the biological individual(s)',               'Sex'),
  vocabField('establishmentMeans',    'Establishment Means',     'How the organism became established at the location','EstablishmentMeans'),
  vocabField('degreeOfEstablishment', 'Degree of Establishment', 'Degree to which the organism survives and expands', 'DegreeOfEstablishment'),
  vocabField('pathway',               'Pathway',                 'Process by which organism came to be at the location','Pathway'),

  // ── Palaeontology ─────────────────────────────────────────────────────────────
  geoTimeField('geologicalTime', 'Geological Time',  'Geological time period or range, e.g. Cretaceous or Jurassic,Cretaceous'),
  suggestField('formation',      'Formation',        'Lithostratigraphic formation name (dwc:formation)'),
  suggestField('member',         'Member',           'Lithostratigraphic member name (dwc:member)'),
  suggestField('group',          'Group',            'Lithostratigraphic group name (dwc:group)'),
  suggestField('bed',            'Bed',              'Lithostratigraphic bed name (dwc:bed)'),

  // ── Data quality / flags ───────────────────────────────────────────────────
  booleanField('hasCoordinate',      'Has Coordinate',       'Limit to records with or without coordinates'),
  booleanField('hasGeospatialIssue', 'Has Geospatial Issue', 'Include/exclude records with coordinate quality issues'),
  booleanField('isSequenced',        'Is Sequenced',         'Has associated genetic sequence data'),
  booleanField('isInCluster',        'Is In Cluster',        'Part of a cluster of related records'),
  booleanField('repatriated',        'Repatriated',          'Publishing country differs from recording country'),
];

export const FILTER_MAP = Object.fromEntries(FILTER_CONFIG.map(f => [f.key, f]));
