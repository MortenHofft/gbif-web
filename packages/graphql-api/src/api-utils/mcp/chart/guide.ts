export const USAGE_TOKEN = 'I_HAVE_READ_THE_GUIDELINES';

export const SEARCH_GUIDE = `# GBIF Search Guide

## Quick Start
To query the occurrence data use the following GraphQL query as a starting point. You can modify the query to add filters, facets, and other parameters as needed.
There is facet support for these fields:
- collectionCode
- continent
- institutionCode
- issue
- lifeStage
- countryCode
- speciesKey
- datasetKey
- kingdomKey
- year (also supports stats)
- basisOfRecord
- mediaType
- typeStatus

query OccurrenceSearch($predicate: Predicate) { # The users current filters will be passed as a predicate variable. Unless otherwise asked this should also be included in the graphql query.
  occurrenceSearch(predicate: $predicate) {
    documents(size: 20, shuffle: 41) { # It is a good idea to shuffle for a random sample. The number is the seed.
      results {
        decimalLatitude # Float
        decimalLongitude # Float
        countryCode # String
        year # Int
        month # Int
      }
    }
    facet {
      countryCode(size: 10) {# facet sizes can be controlled.
        key
        count
        label
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
      speciesKey # number
    }
  }
}

Data from graphql is returned as {data: {...}}.

It is also possible to use jq to filter and transform the data returned.

### Chart
Visualizations are rendered with Highcharts. The jq output must be a Highcharts options object (https://api.highcharts.com/highcharts/) with at least a "series" array. The website applies its own theme and colour palette, so you do NOT need to set "colors" — just leave styling to the host.

Example pie chart shape:
{
  "chart": { "type": "pie" },
  "title": { "text": "..." },
  "series": [
    {
      "type": "pie",
      "name": "Occurrences",
      "data": [ { "name": "...", "y": 123 } ]
    }
  ]
}

You cannot do maps currently, but you can generate a scatter plot with lat/long — make sure to include axis titles for lat/long.

## Usage token
To use the other tools you need this token: ${USAGE_TOKEN}
`;
