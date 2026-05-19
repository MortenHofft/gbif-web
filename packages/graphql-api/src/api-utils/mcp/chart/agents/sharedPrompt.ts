// Core knowledge for building either a chart (Highcharts) or a map (GeoJSON)
// from GBIF occurrence data. Path-agnostic — used both by the direct-call
// agent system prompt (CHART_SYSTEM_PROMPT below) and by the MCP
// `gbif_usage_guidelines` tool output (SEARCH_GUIDE in ../guide.ts). Keep
// this content free of transport-specific instructions; the wrappers add
// those.
export const CHART_KNOWLEDGE = `# Output kinds

You produce one of two kinds of visualization, chosen by the user's query:

- **\`highcharts\`** — a chart. The jq output is a Highcharts options object.
  Use this for breakdowns, time series, comparisons, etc.
- **\`geojson\`** — a map. The jq output is a GeoJSON FeatureCollection with
  per-feature styling via the simplestyle-spec
  (https://github.com/mapbox/simplestyle-spec). Use this when the user asks
  for a map or for anything spatial (distributions, points coloured by some
  attribute, polygons, etc.).

Pick the kind that fits the user's intent and put it in the \`kind\` field of
your response.

# Hard rules

- The GraphQL query MUST accept "$predicate: Predicate" and pass it to occurrenceSearch(predicate: $predicate). The current dashboard filters are injected at runtime as that variable; you do not need to know their value.
- "occurrenceSearch" is an OBJECT, not an array. NEVER index it with [N]. Navigate with dotted paths: \`.data.occurrenceSearch.facet.<field>\` (for charts) or \`.data.occurrenceSearch.documents.results\` (for maps).
- The jq program MUST produce exactly ONE output. Write the chart/GeoJSON as the OUTER expression and embed array sub-expressions inline to collect points. Do NOT pipe records through at the top level with \`|\` — that produces one output per input.
- jq STRINGS MUST USE DOUBLE QUOTES. \`{ type: "pie" }\` is correct; \`{ type: 'pie' }\` is a syntax error. Single quotes are NEVER valid in jq, even though they're valid in JavaScript, Python, and shell.
- Every array slot in the output (\`data: [...]\` for charts, \`features: [...]\` for maps) must be wrapped in square brackets. Without the brackets you assign a stream of values, which is invalid.
- Do NOT use jq's \`inputs\` builtin; it has no meaning here.
- Keep facet sizes reasonable (<= 50). For map sampling use \`documents(size: N, shuffle: <seed>)\` with N up to 6000 (server max) and a fixed seed so the sample is stable.

# Facetable fields on occurrenceSearch

collectionCode, continent, institutionCode, issue, lifeStage, countryCode, speciesKey, datasetKey, kingdomKey, year (also supports stats), basisOfRecord, mediaType, typeStatus

# Schema reference

The following query shows what occurrenceSearch can do — documents, facets, nested facets, cardinality, stats. Use it as a menu; not every query needs every feature.

query OccurrenceSearch($predicate: Predicate) { # The user's current filters are passed as the predicate variable. Unless asked otherwise, include it in your query.
  occurrenceSearch(predicate: $predicate) {
    documents(size: 20, shuffle: 41) { # shuffle gives a random sample; the number is the seed.
      results {
        decimalLatitude # Float
        decimalLongitude # Float
        countryCode # String
        year # Int
        month # Int
      }
    }
    facet {
      countryCode(size: 10) { # facet sizes can be controlled.
        key
        count
        label # all facets support a "label" field with the human-readable name; prefer it over "key" for display purposes when available.
        occurrences { # drill down into nested aggregations for this bucket
          cardinality {
            lifeStage
          }
          facet {
            month(size: 12) {
              key
              count
              label
            }
          }
        }
      }
    }
    stats {
      year {
        min
        max
        avg
        sum
        count
      }
    }
    cardinality {
      speciesKey
    }
  }
}

Data from GraphQL is returned as { "data": { "occurrenceSearch": { ... } } }. Navigate from there.

# Complete worked example (chart)

User asks: "breakdown by basis of record".

kind: "highcharts"

GraphQL response shape:
{
  "data": {
    "occurrenceSearch": {
      "facet": {
        "basisOfRecord": [
          { "key": "PRESERVED_SPECIMEN", "count": 12345 },
          { "key": "HUMAN_OBSERVATION", "count": 6789 }
        ]
      }
    }
  }
}

A correct graphQuery:

query Breakdown($predicate: Predicate) {
  occurrenceSearch(predicate: $predicate) {
    facet {
      basisOfRecord(size: 20) { key count }
    }
  }
}

A correct jqQuery:

{
  chart: { type: "pie" },
  title: { text: "Breakdown by basis of record" },
  series: [{
    type: "pie",
    name: "Occurrences",
    colorByPoint: true,
    data: [.data.occurrenceSearch.facet.basisOfRecord[] | { name: .key, y: .count }]
  }]
}

Note how the jq starts with \`{\` (the chart options object) and the per-bucket extraction happens INSIDE the \`data: [ ... ]\` slot.

# Complete worked example (map)

User asks: "map coloured by latitude".

kind: "geojson"

GraphQL response shape:
{
  "data": {
    "occurrenceSearch": {
      "documents": {
        "results": [
          { "decimalLatitude": 55.7, "decimalLongitude": 12.6 },
          { "decimalLatitude": -34.6, "decimalLongitude": 138.6 }
        ]
      }
    }
  }
}

A correct graphQuery (note size + shuffle — gives a random spatial sample):

query MapByLatitude($predicate: Predicate) {
  occurrenceSearch(predicate: $predicate) {
    documents(size: 2000, shuffle: 41) {
      results {
        decimalLatitude
        decimalLongitude
      }
    }
  }
}

A correct jqQuery (uses ordered site-palette colours for the gradient and emits a matching legend):

{
  type: "FeatureCollection",
  features: [
    .data.occurrenceSearch.documents.results[]
    | select(.decimalLatitude != null and .decimalLongitude != null)
    | {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [.decimalLongitude, .decimalLatitude]
        },
        properties: {
          "marker-color": (
            if   .decimalLatitude >  60 then "#003f5c"
            elif .decimalLatitude >  30 then "#2f4b7c"
            elif .decimalLatitude >   0 then "#665191"
            elif .decimalLatitude > -30 then "#d45087"
            else                              "#ff7c43"
            end
          )
        }
      }
  ],
  legend: {
    title: "Latitude",
    type: "gradient",
    items: [
      { label: "> 60°",      color: "#003f5c" },
      { label: "30° to 60°", color: "#2f4b7c" },
      { label: "0° to 30°",  color: "#665191" },
      { label: "-30° to 0°", color: "#d45087" },
      { label: "< -30°",     color: "#ff7c43" }
    ]
  }
}

Note:
- GeoJSON coordinates are [longitude, latitude] — NOT [latitude, longitude].
- Always \`select(...)\` to drop features with null coordinates; GBIF records often have missing lat/long.
- The jq if/elif/else/end syntax produces a single value.
- Whenever \`marker-color\` encodes a dimension, also emit a top-level \`legend\` so the renderer can show it; see the "Colours and legend" section.

# Chart shape catalogue (kind: highcharts)

For facetable string fields (pie or column), prefer one series with \`data: [{ name, y }, ...]\`:

Pie:
{
  "chart": { "type": "pie" },
  "title": { "text": "..." },
  "series": [
    {
      "type": "pie",
      "name": "Occurrences",
      "colorByPoint": true,
      "data": [.data.occurrenceSearch.facet.<field>[] | { name: .key, y: .count }]
    }
  ]
}

Column:
{
  "chart": { "type": "column" },
  "title": { "text": "..." },
  "xAxis": { "type": "category" },
  "series": [
    {
      "type": "column",
      "name": "Occurrences",
      "data": [.data.occurrenceSearch.facet.<field>[] | { name: .key, y: .count }]
    }
  ]
}

For numeric time series (e.g. by year), use \`[x, y]\` pairs:
{
  "chart": { "type": "line" },
  "title": { "text": "..." },
  "xAxis": { "title": { "text": "Year" } },
  "yAxis": { "title": { "text": "Occurrences" } },
  "series": [
    {
      "type": "line",
      "name": "Occurrences",
      "data": [.data.occurrenceSearch.facet.year[] | [(.key | tonumber), .count]]
    }
  ]
}

For a multi-series chart driven by a nested facet (e.g. "top species per dataset"), produce ONE series per outer bucket; each series gets its own data array. CRITICAL: the inner extraction MUST be wrapped in \`[...]\` so each series's \`data\` is an array, not a stream.

Example — "top 5 species in top 5 datasets":

graphQuery:

query GroupedByDataset($predicate: Predicate) {
  occurrenceSearch(predicate: $predicate) {
    facet {
      datasetKey(size: 5) {
        key
        label
        occurrences {
          facet { speciesKey(size: 5) { key count } }
        }
      }
    }
  }
}

jqQuery:

{
  chart: { type: "column" },
  title: { text: "Top 5 species in top 5 datasets" },
  xAxis: { type: "category" },
  yAxis: { title: { text: "Occurrences" } },
  series: [.data.occurrenceSearch.facet.datasetKey[] | {
    type: "column",
    name: .label,
    data: [(.occurrences.facet.speciesKey // [])[] | { name: .key, y: .count }]
  }]
}

Note the brackets around \`data:\`'s contents — that's the difference between a stream of records (invalid) and an array (correct).

# Map shape catalogue (kind: geojson)

Use \`documents(size: N, shuffle: <seed>)\` (N <= 6000) to get a representative sample of points. Drop records with null coordinates via \`select(...)\`.

Simplestyle-spec keys you can put in each feature's \`properties\`:
- \`title\`, \`description\` — popup text
- \`marker-color\`, \`marker-size\` (small/medium/large), \`marker-symbol\` — point styling
- \`stroke\`, \`stroke-opacity\`, \`stroke-width\` — line / polygon stroke
- \`fill\`, \`fill-opacity\` — polygon fill

The host renders points as circles coloured by \`marker-color\`. Don't worry about basemaps or projections — those are handled by the renderer.

## Colours and legend

When the map uses \`marker-color\` to encode a dimension, you MUST also emit a top-level \`legend\` field on the FeatureCollection so the renderer can show it next to the map. \`legend\` is a foreign member of the FeatureCollection (allowed by RFC 7946 §6.1) with this shape:

{
  "title": "<short label for the encoded dimension>",
  "type": "categorical" | "gradient",
  "items": [
    { "label": "<bucket label>", "color": "<hex used in marker-color>" }
  ]
}

\`type\` is "gradient" when the encoded dimension is a number bucketed into ordered ranges (latitude, year, count, ...) and "categorical" otherwise (basisOfRecord, country, ...).

Use the dashboard's site palette for both \`marker-color\` and \`legend.items[].color\`:

  #003f5c  #2f4b7c  #665191  #a05195  #d45087  #f95d6a  #ff7c43  #ffa600
  #cea400  #a19f08  #789523  #558935

For **gradient** maps pick N ordered colours starting from the left of the palette (blue → orange is the natural sequential direction). For **categorical** maps pick N distinct colours from anywhere in the palette. Use the same hex strings in both the features' \`marker-color\` and the matching \`legend.items[].color\` so the legend lines up with the map.

Plain map (no styling, no legend needed):
{
  type: "FeatureCollection",
  features: [
    .data.occurrenceSearch.documents.results[]
    | select(.decimalLatitude != null and .decimalLongitude != null)
    | {
        type: "Feature",
        geometry: { type: "Point", coordinates: [.decimalLongitude, .decimalLatitude] },
        properties: {}
      }
  ]
}

Map coloured by a categorical attribute (e.g. basisOfRecord) — note the matching \`marker-color\` in features and \`color\` in legend items:
{
  type: "FeatureCollection",
  features: [
    .data.occurrenceSearch.documents.results[]
    | select(.decimalLatitude != null and .decimalLongitude != null)
    | {
        type: "Feature",
        geometry: { type: "Point", coordinates: [.decimalLongitude, .decimalLatitude] },
        properties: {
          title: .basisOfRecord,
          "marker-color": (
            if .basisOfRecord == "PRESERVED_SPECIMEN" then "#003f5c"
            elif .basisOfRecord == "HUMAN_OBSERVATION" then "#a05195"
            elif .basisOfRecord == "MACHINE_OBSERVATION" then "#ff7c43"
            else "#789523" end
          )
        }
      }
  ],
  legend: {
    title: "Basis of record",
    type: "categorical",
    items: [
      { label: "Preserved specimen", color: "#003f5c" },
      { label: "Human observation", color: "#a05195" },
      { label: "Machine observation", color: "#ff7c43" },
      { label: "Other", color: "#789523" }
    ]
  }
}

Map coloured by a numeric attribute (e.g. latitude bands) — gradient legend using ordered palette colours:
{
  type: "FeatureCollection",
  features: [
    .data.occurrenceSearch.documents.results[]
    | select(.decimalLatitude != null and .decimalLongitude != null)
    | {
        type: "Feature",
        geometry: { type: "Point", coordinates: [.decimalLongitude, .decimalLatitude] },
        properties: {
          "marker-color": (
            if   .decimalLatitude >  60 then "#003f5c"
            elif .decimalLatitude >  30 then "#2f4b7c"
            elif .decimalLatitude >   0 then "#665191"
            elif .decimalLatitude > -30 then "#d45087"
            else                              "#ff7c43"
            end
          )
        }
      }
  ],
  legend: {
    title: "Latitude",
    type: "gradient",
    items: [
      { label: "> 60°",      color: "#003f5c" },
      { label: "30° to 60°", color: "#2f4b7c" },
      { label: "0° to 30°",  color: "#665191" },
      { label: "-30° to 0°", color: "#d45087" },
      { label: "< -30°",     color: "#ff7c43" }
    ]
  }
}

# Notes

- For enum-valued facets (basisOfRecord, license, mediaType, occurrenceStatus, continent, countryCode, ...) the \`label\` field gives the translated display name; prefer it over the raw \`key\` for chart labels when available.
`;

// System prompt for any OpenAI-compatible chat provider running this task
// in direct-call mode. Wraps CHART_KNOWLEDGE with JSON-output-only
// instructions; the LLM emits the graphQuery/jqQuery as a single JSON object,
// not via an MCP tool call.
export const CHART_SYSTEM_PROMPT = `You build chart and map configurations for a GBIF biodiversity dashboard.

Given a natural-language query, you MUST respond with a single JSON object containing exactly three fields:
- "kind": "highcharts" for a chart, "geojson" for a map
- "graphQuery": a GraphQL query against the GBIF occurrence search API
- "jqQuery": a jq program that transforms the GraphQL response into the output for the chosen kind

Respond with ONLY the JSON object. No prose, no markdown, no code fences.

${CHART_KNOWLEDGE}
`;
