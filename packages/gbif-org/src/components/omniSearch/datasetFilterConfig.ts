// Filter catalogue for the GBIF dataset (registry) search endpoint.
// Param reference: https://techdocs.gbif.org/en/openapi/v1/registry#/Datasets/searchDatasets
import type { FilterFieldConfig, Suggestion } from './types';

// Fetch a single registry entity and return its display title.
const resolveGbifEntity =
  (apiPath: string, titleProp = 'title') =>
  async (value: string): Promise<string> => {
    try {
      const res = await fetch(`https://api.gbif.org/v1/${apiPath}/${encodeURIComponent(value)}`);
      if (!res.ok) return value;
      const d = await res.json();
      return d[titleProp] ?? d.title ?? d.name ?? value;
    } catch {
      return value;
    }
  };

// ISO 3166-1 alpha-2 codes recognised by the GBIF country enumeration.
// Resolved to friendly names with Intl.DisplayNames when available; falls
// back to the bare code in environments that don't ship the API (older
// browsers, jsdom). Kept as a static list so the dropdown can render
// without an upfront network round-trip.
const COUNTRY_CODES = [
  'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ',
  'BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS',
  'BT','BV','BW','BY','BZ','CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN',
  'CO','CR','CU','CV','CW','CX','CY','CZ','DE','DJ','DK','DM','DO','DZ','EC','EE',
  'EG','EH','ER','ES','ET','FI','FJ','FK','FM','FO','FR','GA','GB','GD','GE','GF',
  'GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY','HK','HM',
  'HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT','JE','JM',
  'JO','JP','KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ','LA','LB','LC',
  'LI','LK','LR','LS','LT','LU','LV','LY','MA','MC','MD','ME','MF','MG','MH','MK',
  'ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ','NA',
  'NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ','OM','PA','PE','PF','PG',
  'PH','PK','PL','PM','PN','PR','PS','PT','PW','PY','QA','RE','RO','RS','RU','RW',
  'SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS',
  'ST','SV','SX','SY','SZ','TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO',
  'TR','TT','TV','TW','TZ','UA','UG','UM','US','UY','UZ','VA','VC','VE','VG','VI',
  'VN','VU','WF','WS','XK','YE','YT','ZA','ZM','ZW',
];

const regionNames = (() => {
  try {
    return typeof Intl !== 'undefined' && Intl.DisplayNames
      ? new Intl.DisplayNames(['en'], { type: 'region' })
      : null;
  } catch {
    return null;
  }
})();

const countryLabel = (code: string): string => {
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
};

const COUNTRY_NAMES: Record<string, string> = Object.fromEntries(
  COUNTRY_CODES.map((c) => [c, countryLabel(c)])
);

// The dataset registry search API doesn't expose negation or
// "has value" / "has no value" predicates, so every field opts out of
// both. The defaults spread first, so any field could re-enable a
// capability by setting the flag itself.
const datasetFieldDefaults = { supportsNegation: false, supportsExistence: false };

const RAW_DATASET_FILTER_CONFIG: FilterFieldConfig[] = [
  // ── Full-text ──────────────────────────────────────────────────────────────
  {
    key: 'q',
    label: 'Text Search',
    hint: 'Free-text search across dataset metadata',
    type: 'freeText',
    singleValue: true,
    formatValue: (v) => `"${v}"`,
  },

  // ── Dataset attributes ─────────────────────────────────────────────────────
  {
    key: 'type',
    label: 'Dataset Type',
    hint: 'Kind of dataset (OCCURRENCE, CHECKLIST, …)',
    type: 'enum',
    values: ['OCCURRENCE', 'CHECKLIST', 'METADATA', 'SAMPLING_EVENT'],
  },

  // ── Publisher / hosting / country ──────────────────────────────────────────
  {
    key: 'publishingOrg',
    label: 'Publisher',
    hint: 'Organisation that published the dataset',
    type: 'suggestEntity',
    suggestUrl: 'https://api.gbif.org/v1/organization/suggest',
    toSuggestion: (item): Suggestion => ({
      value: String(item.key),
      label: item.title ?? item.name ?? String(item.key),
      meta: null,
    }),
    resolveLabel: resolveGbifEntity('organization'),
  },
  {
    key: 'hostingOrg',
    label: 'Hosting Organisation',
    hint: 'Organisation hosting the dataset technical installation',
    type: 'suggestEntity',
    suggestUrl: 'https://api.gbif.org/v1/organization/suggest',
    toSuggestion: (item): Suggestion => ({
      value: String(item.key),
      label: item.title ?? item.name ?? String(item.key),
      meta: null,
    }),
    resolveLabel: resolveGbifEntity('organization'),
  },
  {
    key: 'publishingCountry',
    label: 'Publishing Country',
    hint: 'Country of the publishing organisation (ISO 2-letter code)',
    type: 'enum',
    values: COUNTRY_CODES.map((c) => ({ value: c, label: COUNTRY_NAMES[c] })),
    formatValue: (v) => COUNTRY_NAMES[v] ?? v,
  },

  // ── Dataset (for quick selection via root entity) ─────────────────────────
  {
    key: 'datasetKey',
    label: 'Dataset',
    hint: 'Specific dataset by name',
    type: 'suggestEntity',
    suggestUrl: 'https://api.gbif.org/v1/dataset/suggest',
    toSuggestion: (item): Suggestion => ({
      value: String(item.key),
      label: item.title ?? String(item.key),
      meta: item.type ?? null,
    }),
    resolveLabel: resolveGbifEntity('dataset'),
  },
];

export const DATASET_FILTER_CONFIG: FilterFieldConfig[] = RAW_DATASET_FILTER_CONFIG.map((f) => ({
  ...datasetFieldDefaults,
  ...f,
}));

export const DATASET_FILTER_MAP: Record<string, FilterFieldConfig> = Object.fromEntries(
  DATASET_FILTER_CONFIG.map((f) => [f.key, f])
);
