import { ApolloServer } from 'apollo-server-express';
import { ExpressContext } from 'apollo-server-express/dist/ApolloServer';
import { executeChart } from './executeChart';

const FAKE_GRAPH_QUERY = `query BasisOfRecordBreakdown($predicate: Predicate) {
  occurrenceSearch(predicate: $predicate) {
    facet {
      basisOfRecord(size: 20) {
        key
        count
      }
    }
  }
}`;

// jq program that turns the GraphQL response into a Highcharts options object
// for a pie chart of the basisOfRecord facet.
const FAKE_JQ_QUERY = `{
  chart: { type: "pie" },
  title: { text: "Breakdown by basis of record" },
  credits: { enabled: false },
  tooltip: { pointFormat: "<b>{point.y}</b> ({point.percentage:.1f}%)" },
  plotOptions: {
    pie: {
      innerSize: "50%",
      dataLabels: { enabled: true, format: "{point.name}" }
    }
  },
  series: [
    {
      type: "pie",
      name: "Occurrences",
      colorByPoint: true,
      data: [.data.occurrenceSearch.facet.basisOfRecord[] | { name: .key, y: .count }]
    }
  ]
}`;

interface AskArgs {
  query: string;
  queryId: string;
  apolloServer: ApolloServer<ExpressContext>;
}

export interface AskResult {
  stub: true;
  query: string;
  chartId: string;
}

// Stand-in for the real LLM agent. Always produces the same chart (basis-of-
// record pie chart) regardless of the user's query. The signature matches what
// a real agent integration would look like, so swapping this out later is a
// drop-in change.
export default async function ask({
  query,
  queryId,
  apolloServer,
}: AskArgs): Promise<AskResult> {
  if (typeof query !== 'string' || query.length === 0) {
    throw new Error('Query must be a non-empty string');
  }

  const { chartId } = await executeChart({
    graphQuery: FAKE_GRAPH_QUERY,
    jqQuery: FAKE_JQ_QUERY,
    queryId,
    apolloServer,
  });

  return { stub: true, query, chartId };
}
