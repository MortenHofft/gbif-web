// Deterministic agent that returns canned LLM responses for testing the
// chart pipeline's error handling. Pick a scenario by starting your query
// with "debug: <name>" (e.g. "debug: graphql-error"); unknown or missing
// names default to the working "ok" scenario.
//
// Goes through the same runWithRetry → runChartFromAgentJson → executeChart
// path as the real agents, so every retry hint, JSON-recovery branch,
// graphQuery auto-repair, and downstream validator runs end-to-end. Token
// cost zero; latency near-zero.
//
// To use:
//   1. set `chartAgent: debug` in packages/graphql-api/.env
//   2. in the Custom chart card, type e.g. "debug: jq-single-quotes"
//
// Add new scenarios by appending to SCENARIOS below.
import { ChatMessage, LlmCaller, runWithRetry } from './llmCall';
import { Agent } from './types';

// Each scenario produces a single response string. Most are valid JSON
// containing { kind, graphQuery, jqQuery } — the cases that are *not*
// (empty, bad-json-*) test the agent-* stages before the pipeline.
const SCENARIOS: Record<string, string> = {
  // Success path — the canonical basisOfRecord pie.
  ok: JSON.stringify({
    kind: 'highcharts',
    graphQuery:
      'query BasisOfRecord($predicate: Predicate) { occurrenceSearch(predicate: $predicate) { facet { basisOfRecord(size: 20) { key count label } } } }',
    jqQuery:
      '{ chart: { type: "pie" }, title: { text: "Breakdown by basis of record" }, series: [{ type: "pie", name: "Occurrences", colorByPoint: true, data: [.data.occurrenceSearch.facet.basisOfRecord[] | { name: (.label // .key), y: .count }] }] }',
  }),

  test: JSON.stringify({
    kind: 'highcharts',
    graphQuery:
      'query CountriesByYear($predicate: Predicate) { occurrenceSearch(predicate: $predicate) { facet { countryCode(size: 12) { key count label occurrences { facet { year(size: 50) { key count } } } } } } }',
    jqQuery:
      '.data.occurrenceSearch.facet.countryCode as $cc | ([$cc[] | (.occurrences.facet.year // [])[] | (.key | tonumber)] | unique) as $all | ($all | max) as $ymax | ([$all[] | select(. > $ymax - 50)] | sort) as $years | { chart: { type: "streamgraph" }, title: { text: "Occurrences by country over the last 50 years" }, xAxis: { categories: [$years[] | tostring], type: "category", tickInterval: 5 }, yAxis: { visible: false }, plotOptions: { series: { marker: { enabled: false } } }, series: [$cc[] as $c | { type: "streamgraph", name: ($c.label // $c.key), data: [$years[] as $y | (($c.occurrences.facet.year // []) | map(select((.key | tonumber) == $y)) | (.[0].count // 0))] }] }',
  }),

  // Hits the GraphQL schema-validation path: facets don't accept sortBy.
  'graphql-error': JSON.stringify({
    kind: 'highcharts',
    graphQuery:
      'query Bad($predicate: Predicate) { occurrenceSearch(predicate: $predicate) { facet { basisOfRecord(size: 1, sortBy: COUNT, sortOrder: DESC) { key count } } } }',
    jqQuery:
      '{ chart: { type: "pie" }, series: [{ type: "pie", name: "x", data: [.data.occurrenceSearch.facet.basisOfRecord[] | { name: .key, y: .count }] }] }',
  }),

  // jq strings with single quotes — should trigger our jq-stage feedback's
  // single-quote detector.
  'jq-single-quotes': JSON.stringify({
    kind: 'highcharts',
    graphQuery:
      'query OK($predicate: Predicate) { occurrenceSearch(predicate: $predicate) { facet { basisOfRecord(size: 20) { key count label } } } }',
    jqQuery:
      "{ chart: { type: 'pie' }, series: [{ type: 'pie', name: 'Occurrences', data: [.data.occurrenceSearch.facet.basisOfRecord[] | { name: .key, y: .count }] }] }",
  }),

  // The jq // (alternative) operator without surrounding parens inside an
  // object literal — should trigger our jq-stage parens hint.
  'jq-no-parens': JSON.stringify({
    kind: 'highcharts',
    graphQuery:
      'query OK($predicate: Predicate) { occurrenceSearch(predicate: $predicate) { facet { basisOfRecord(size: 20) { key count label } } } }',
    jqQuery:
      '{ chart: { type: "pie" }, series: [{ type: "pie", name: "Occurrences", data: [.data.occurrenceSearch.facet.basisOfRecord[] | { name: .label // .key, y: .count }] }] }',
  }),

  // GraphQL with a missing trailing closing brace — auto-repair should
  // append one and the call should succeed. Verifies tryRepairGraphQuery.
  'missing-brace': JSON.stringify({
    kind: 'highcharts',
    graphQuery:
      'query Truncated($predicate: Predicate) { occurrenceSearch(predicate: $predicate) { facet { basisOfRecord(size: 20) { key count label } } } ',
    jqQuery:
      '{ chart: { type: "pie" }, series: [{ type: "pie", name: "Occurrences", colorByPoint: true, data: [.data.occurrenceSearch.facet.basisOfRecord[] | { name: (.label // .key), y: .count }] }] }',
  }),

  // Trailing garbage after a valid JSON object — extractFirstJsonObject
  // recovers, the call succeeds.
  'bad-json-recoverable': `${JSON.stringify({
    kind: 'highcharts',
    graphQuery:
      'query OK($predicate: Predicate) { occurrenceSearch(predicate: $predicate) { facet { basisOfRecord(size: 20) { key count label } } } }',
    jqQuery:
      '{ chart: { type: "pie" }, series: [{ type: "pie", name: "Occurrences", colorByPoint: true, data: [.data.occurrenceSearch.facet.basisOfRecord[] | { name: (.label // .key), y: .count }] }] }',
  })}\n}`,

  // Free-text response with no JSON anywhere — both parse and recovery
  // fail; user sees the agent-json-parse error.
  'bad-json-unrecoverable':
    "Sure! Here is a pie chart breakdown by basis of record, with the data sorted by count descending. Let me know if you'd like a different visualisation.",

  // jqQuery as a nested JSON object instead of a string — triggers
  // agent-shape; tests the new "jqQuery must be a STRING" feedback.
  'bad-shape': JSON.stringify({
    kind: 'highcharts',
    graphQuery:
      'query OK($predicate: Predicate) { occurrenceSearch(predicate: $predicate) { facet { basisOfRecord(size: 20) { key count label } } } }',
    jqQuery: { chart: { type: 'pie' }, series: [] },
  }),

  // Output from jq is a JSON object but not a valid Highcharts options
  // object (missing series and chart).
  'invalid-highcharts': JSON.stringify({
    kind: 'highcharts',
    graphQuery:
      'query OK($predicate: Predicate) { occurrenceSearch(predicate: $predicate) { facet { basisOfRecord(size: 20) { key count label } } } }',
    jqQuery: '{ title: { text: "No series" } }',
  }),

  // Empty response — triggers agent-empty.
  empty: '',
};

const SCENARIO_KEYS = Object.keys(SCENARIOS);

// Lenient matching: the user is already on the debug agent (chartAgent set
// to "debug"), so we treat the whole query as a scenario name. Accepts
// "graphql-error", "debug: graphql-error", and "DEBUG:graphql-error" alike.
// Falls back to "ok" when nothing recognisable matches, with a warning so
// the case is visible in the server log.
function pickScenario(query: string): string {
  const cleaned = query
    .trim()
    .toLowerCase()
    .replace(/^debug\s*:\s*/i, '')
    .trim();
  if (cleaned in SCENARIOS) return cleaned;
  // eslint-disable-next-line no-console
  console.warn(
    `[chart] debug agent received "${query}" — no matching scenario, falling back to "ok". Available: ${SCENARIO_KEYS.join(
      ', ',
    )}`,
  );
  return 'ok';
}

const debugAgent: Agent = {
  name: 'debug',
  isAvailable: () => true,
  async run({ query, queryId }) {
    const scenario = pickScenario(query);
    const canned = SCENARIOS[scenario];

    const caller: LlmCaller = {
      provider: 'debug',
      model: `scenario:${scenario}`,
      async call(_messages: ChatMessage[]) {
        return {
          text: canned,
          rawModel: `scenario:${scenario}`,
          // Surface the menu in usage so it shows up in AgentResult.raw —
          // useful when typing the wrong scenario and falling back to ok.
          usage: { availableScenarios: SCENARIO_KEYS },
        };
      },
    };

    return runWithRetry({
      caller,
      // Empty — the canned response doesn't actually depend on the prompt,
      // and we want fast turnaround without dragging the full CHART_KNOWLEDGE
      // through each debug call.
      systemPrompt: '',
      userQuery: query,
      queryId,
    });
  },
};

export default debugAgent;
