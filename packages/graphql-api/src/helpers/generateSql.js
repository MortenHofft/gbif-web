import config from '@/config';
import { signJson, verifyJson } from './utils';

const defaultUncertainty = 1000;
const sqlEndpoint = config.apiv1;

function generateMachineDescription(parameters, sql) {
  const signature = signJson({ sql, parameters });
  return { type: 'CUBE', signature, parameters };
}

function nameLookup(name, checklistKey) {
  if (checklistKey === config.gbifBackboneUUID) {
    if (name === 'order') return `occurrence."order"`;
    return `occurrence.${name}`;
  }
  const lower = name.toLowerCase();
  const ranks = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species', 'taxon', 'acceptedtaxon'];
  const lookup = {};
  ranks.forEach((rank) => {
    lookup[rank] = `occurrence.classificationdetails['${checklistKey}']['${rank}']`;
    lookup[`${rank}key`] = `occurrence.classificationdetails['${checklistKey}']['${rank}key']`;
  });
  if (lower === 'acceptedscientificname') {
    return `occurrence.classificationdetails['${checklistKey}']['acceptedscientificname']`;
  }
  return lookup[lower] || name;
}

export function getGbifMachineDescription(machineDescription, sql) {
  if (typeof machineDescription !== 'object') return null;
  const { signature, parameters } = machineDescription;
  if (!signature || !parameters) return null;
  const signedByUs = verifyJson({ sql, parameters }, signature);
  if (!signedByUs) return null;
  const { signature: _, ...rest } = machineDescription;
  return rest;
}

const WHERE_PREDICATE_RESTRICTIONS = {
  taxonomicDimension: {
    KINGDOM: [{ type: 'isNotNull', parameter: 'KINGDOM_KEY' }],
    PHYLUM: [{ type: 'isNotNull', parameter: 'PHYLUM_KEY' }],
    CLASS: [{ type: 'isNotNull', parameter: 'CLASS_KEY' }],
    ORDER: [{ type: 'isNotNull', parameter: 'ORDER_KEY' }],
    FAMILY: [{ type: 'isNotNull', parameter: 'FAMILY_KEY' }],
    GENUS: [{ type: 'isNotNull', parameter: 'GENUS_KEY' }],
    SPECIES: [{ type: 'isNotNull', parameter: 'SPECIES_KEY' }],
    EXACT_TAXON: [{ type: 'isNotNull', parameter: 'TAXON_KEY' }],
    ACCEPTED_TAXON: [{ type: 'isNotNull', parameter: 'ACCEPTED_TAXON_KEY' }],
  },
  temporalDimension: {
    YEAR: [{ type: 'isNotNull', parameter: 'YEAR' }],
    YEARMONTH: [
      { type: 'isNotNull', parameter: 'YEAR' },
      { type: 'isNotNull', parameter: 'MONTH' },
    ],
    DATE: [
      { type: 'isNotNull', parameter: 'YEAR' },
      { type: 'isNotNull', parameter: 'MONTH' },
      { type: 'isNotNull', parameter: 'DAY' },
    ],
  },
  spatialDimension: {
    EEA_REFERENCE_GRID: [{ type: 'equals', key: 'HAS_COORDINATE', value: 'true' }],
    EXTENDED_QUARTER_DEGREE_GRID: [{ type: 'equals', key: 'HAS_COORDINATE', value: 'true' }],
    ISEA3H_GRID: [{ type: 'equals', key: 'HAS_COORDINATE', value: 'true' }],
    MILITARY_GRID_REFERENCE_SYSTEM: [{ type: 'equals', key: 'HAS_COORDINATE', value: 'true' }],
    COUNTRY: [{ type: 'equals', key: 'HAS_COORDINATE', value: 'true' }],
  },
};

async function getWhereClause({
  predicate,
  taxonomicDimension,
  temporalDimension,
  spatialDimension,
  checklistKey,
}) {
  const restrictions = [];
  if (taxonomicDimension) {
    const r = WHERE_PREDICATE_RESTRICTIONS.taxonomicDimension[taxonomicDimension];
    if (r) {
      if (checklistKey) r[0].checklistKey = checklistKey;
      restrictions.push(...r);
    }
  }
  if (temporalDimension) {
    const r = WHERE_PREDICATE_RESTRICTIONS.temporalDimension[temporalDimension];
    if (r) restrictions.push(...r);
  }
  if (spatialDimension) {
    const r = WHERE_PREDICATE_RESTRICTIONS.spatialDimension[spatialDimension];
    if (r) restrictions.push(...r);
  }
  if (restrictions.length === 0) {
    throw new Error(
      'No restrictions found, which is unexpected as there should always be at least one dimension.',
    );
  }

  const restrictionsPredicate = { type: 'and', predicates: restrictions };
  const combinedPredicate = predicate
    ? { type: 'and', predicates: [predicate, restrictionsPredicate] }
    : restrictionsPredicate;

  const sqlResponse = await fetch(`${sqlEndpoint}/occurrence/download/request/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ predicate: combinedPredicate }),
  }).then((r) => r.json());

  const sqlString = sqlResponse.sql.replace(/\n/g, ' ').replace(/\s\s/g, ' ');
  const whereIndex = sqlString.toUpperCase().indexOf('WHERE');
  return ` ${sqlString.substring(whereIndex)} `;
}

// Each rank level includes all fields from the ranks above it.
const RANK_CHAIN = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];
const RANK_DEPTH = { KINGDOM: 1, PHYLUM: 2, CLASS: 3, ORDER: 4, FAMILY: 5, GENUS: 6, SPECIES: 7 };
const RANK_EXTRAS = {
  EXACT_TAXON: ['taxonKey', 'scientificName'],
  ACCEPTED_TAXON: ['acceptedTaxonKey', 'acceptedScientificName'],
};

function buildTaxonomyFields(taxonomy, checklistKey) {
  const depth = RANK_DEPTH[taxonomy] ?? 7;
  const fields = [];
  for (let i = 0; i < depth; i++) {
    const rank = RANK_CHAIN[i];
    fields.push(nameLookup(rank, checklistKey));
    fields.push(nameLookup(`${rank}Key`, checklistKey));
  }
  (RANK_EXTRAS[taxonomy] ?? []).forEach((f) => fields.push(nameLookup(f, checklistKey)));
  return fields.join(', ');
}

const TEMPORAL_LOOKUP = {
  YEAR: {
    dimension: `"year"`,
    select: `"year"`,
    groupBy: `"year"`,
  },
  YEARMONTH: {
    dimension: `PRINTF('%04d-%02d', "year", "month")`,
    select: `PRINTF('%04d-%02d', "year", "month") AS yearMonth`,
    groupBy: `yearMonth`,
  },
  DATE: {
    dimension: `PRINTF('%04d-%02d-%02d', "year", "month", "day")`,
    select: `PRINTF('%04d-%02d-%02d', "year", "month", "day") AS yearMonthDay`,
    groupBy: `yearMonthDay`,
  },
};

const template = `SELECT
  {{DIMENSIONS}},
  {{MEASUREMENTS}}
FROM
  occurrence
{{FILTERS}}
GROUP BY
  {{GROUP_BY}}`;

export default async function generateSql(parameters) {
  const {
    taxonomy,
    temporal,
    spatial,
    resolution = 0,
    randomize,
    higherGroups,
    includeTemporalUncertainty,
    includeSpatialUncertainty,
    predicate,
    checklistKey = config.gbifBackboneUUID,
  } = parameters;

  let filters;
  try {
    filters = await getWhereClause({
      predicate,
      taxonomicDimension: taxonomy,
      temporalDimension: temporal,
      spatialDimension: spatial,
      checklistKey,
    });
  } catch (error) {
    return { error: error.message, sql: null };
  }

  const dimensions = [];
  const groupBy = [];
  const measurements = ['COUNT(*) AS occurrences'];

  if (includeTemporalUncertainty === 'YES') {
    measurements.push(
      'MIN(GBIF_TEMPORALUNCERTAINTY(eventdate, eventtime)) AS minTemporalUncertainty',
    );
  }
  if (includeSpatialUncertainty === 'YES') {
    measurements.push(
      'MIN(COALESCE(coordinateUncertaintyInMeters, 1000)) AS minCoordinateUncertaintyInMeters',
    );
  }

  if (taxonomy) {
    const fields = buildTaxonomyFields(taxonomy, checklistKey);
    dimensions.push(fields);
    groupBy.push(fields);
  }

  if (temporal) {
    dimensions.push(TEMPORAL_LOOKUP[temporal].select);
    groupBy.push(TEMPORAL_LOOKUP[temporal].groupBy);
  }

  const coordinateUncertainty =
    randomize === 'YES'
      ? `COALESCE(coordinateUncertaintyInMeters, ${defaultUncertainty})`
      : '0.0';

  const spatialLookup = {
    EEA_REFERENCE_GRID: {
      dimension: `GBIF_EEARGCode(${resolution}, decimalLatitude, decimalLongitude, ${coordinateUncertainty})`,
      groupBy: `eeaCellCode`,
    },
    EXTENDED_QUARTER_DEGREE_GRID: {
      dimension: `GBIF_EQDGCode(${resolution}, decimalLatitude, decimalLongitude, ${coordinateUncertainty})`,
      groupBy: 'eqdCellCode',
    },
    ISEA3H_GRID: {
      dimension: `GBIF_ISEA3HCode(${resolution}, decimalLatitude, decimalLongitude, ${coordinateUncertainty})`,
      groupBy: 'isea3hCellCode',
    },
    MILITARY_GRID_REFERENCE_SYSTEM: {
      dimension: `GBIF_MGRSCode(${resolution}, decimalLatitude, decimalLongitude, ${coordinateUncertainty})`,
      groupBy: 'mgrsCellCode',
    },
    COUNTRY: {
      dimension: `countryCode`,
      groupBy: 'countryCode',
    },
  };

  if (spatial) {
    dimensions.push(`${spatialLookup[spatial].dimension} AS ${spatialLookup[spatial].groupBy}`);
    groupBy.push(spatialLookup[spatial].groupBy);
  }

  const higherGroupsList = Array.isArray(higherGroups)
    ? higherGroups
    : higherGroups
      ? [higherGroups]
      : [];

  higherGroupsList.forEach((rank) => {
    const rankLower = rank.toLowerCase();
    const key = nameLookup(`${rankLower}Key`, checklistKey);
    const partitionParts = [key];
    if (spatial) partitionParts.push(spatialLookup[spatial].dimension);
    if (temporal) partitionParts.push(TEMPORAL_LOOKUP[temporal].dimension);
    dimensions.push(
      `IF(ISNULL(${key}), NULL, SUM(COUNT(*)) OVER (PARTITION BY ${partitionParts.join(', ')})) AS ${rankLower}Count`,
    );
  });

  const sql = template
    .replace('{{DIMENSIONS}}', dimensions.filter(Boolean).join(', '))
    .replace('{{MEASUREMENTS}}', measurements.join(', '))
    .replace('{{FILTERS}}', filters)
    .replace('{{GROUP_BY}}', groupBy.join(', '));

  return { error: null, sql };
}

export async function getSql({ query: parameters }) {
  const { error, sql } = await generateSql(parameters);
  if (error) {
    return { error, sql };
  }

  const validation = await fetch(`${sqlEndpoint}/occurrence/download/request/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, format: 'SQL_TSV_ZIP' }),
  }).then((r) => r.json());

  if (!validation.sql) {
    return {
      error: 'Validation failed',
      validationResponse: validation,
    };
  }

  const machineDescription = generateMachineDescription(parameters, validation.sql);

  return {
    comment:
      'This endpoint is not part of a stable public API. It is an internal endpoint to generate SQL for the occurrence download B cube service.',
    error,
    sql: validation.sql,
    machineDescription,
  };
}
