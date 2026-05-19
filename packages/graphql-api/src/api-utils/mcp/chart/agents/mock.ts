import { executeChart } from '../executeChart';
import { Agent } from './types';

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

// Deterministic stub. Always produces the same chart (basisOfRecord pie)
// regardless of the user's query. Kept as a working example of an Agent
// implementation and as a zero-config fallback when no real provider is set
// up. It also doubles as a useful baseline when comparing real-agent output
// during experiments.
export const mockAgent: Agent = {
  name: 'mock',
  isAvailable: () => true,
  async run({ query, queryId, apolloServer }) {
    if (typeof query !== 'string' || query.length === 0) {
      throw new Error('Query must be a non-empty string');
    }

    await executeChart({
      graphQuery: FAKE_GRAPH_QUERY,
      jqQuery: FAKE_JQ_QUERY,
      queryId,
      apolloServer,
    });

    return { provider: 'mock', raw: { stub: true, query } };
  },
};
