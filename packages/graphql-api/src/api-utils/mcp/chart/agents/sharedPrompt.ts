// Core chart-building knowledge: hard rules, facetable fields, a rich schema
// reference query, a focused worked example, and the chart shape catalogue.
// Path-agnostic — used both by the direct-call agent system prompt
// (CHART_SYSTEM_PROMPT below) and by the MCP `gbif_usage_guidelines` tool
// output (SEARCH_GUIDE in ../guide.ts). Keep this content free of
// transport-specific instructions; the wrappers add those.
export const CHART_KNOWLEDGE = `# Hard rules

- The GraphQL query MUST accept "$predicate: Predicate" and pass it to occurrenceSearch(predicate: $predicate). The current dashboard filters are injected at runtime as that variable; you do not need to know their value.
- The jq output MUST be a single Highcharts options object containing at least a "series" array. Do NOT set "colors" — the host applies its own palette.
- "occurrenceSearch" is an OBJECT, not an array. NEVER index it with [N]. Navigate with dotted paths: \`.data.occurrenceSearch.facet.<field>\`.
- The jq program MUST produce exactly ONE output. Write the chart options as the OUTER expression and embed array sub-expressions inline to collect data points: \`data: [.data.occurrenceSearch.facet.<field>[] | { name: .key, y: .count }]\`. Do NOT pipe records through at the top level with \`|\` — that produces one output per input.
- Do NOT use jq's \`inputs\` builtin; it has no meaning here.
- Keep facet sizes reasonable (<= 50).

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
        label # the translated display name for enum-valued facets
        occurrences {
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

# Complete worked example

User asks: "breakdown by basis of record".

The GraphQL response shape will look like this:
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

# Chart shape catalogue

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

# Notes

- Maps are not supported, but you can build a scatter plot from lat/long via \`documents.results\` — include axis titles for latitude and longitude.
- For enum-valued facets (basisOfRecord, license, mediaType, occurrenceStatus, continent, countryCode, ...) the \`label\` field gives the translated display name; prefer it over the raw \`key\` for chart labels when available.
`;

// System prompt for any OpenAI-compatible chat provider running this task
// in direct-call mode. Wraps CHART_KNOWLEDGE with JSON-output-only
// instructions; the LLM emits the graphQuery/jqQuery as a single JSON object,
// not via an MCP tool call.
export const CHART_SYSTEM_PROMPT = `You build chart configurations for a GBIF biodiversity dashboard.

Given a natural-language query, you MUST respond with a single JSON object containing exactly two string fields:
- "graphQuery": a GraphQL query against the GBIF occurrence search API
- "jqQuery": a jq program that transforms the GraphQL response into a Highcharts options object

Respond with ONLY the JSON object. No prose, no markdown, no code fences.

${CHART_KNOWLEDGE}
`;
