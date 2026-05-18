import rawConfig from '@/config';
import { McpError } from '../errors';
import { executeChart } from '../executeChart';
import { Agent } from './types';

const config = rawConfig as typeof rawConfig & {
  mistralApiKey?: string;
  mistralModel?: string;
};

const MISTRAL_ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';
const DEFAULT_MODEL = 'mistral-small-latest';

// Direct-call prompt (no MCP tool roundtrip). Mistral emits JSON with
// graphQuery + jqQuery, we run it through executeChart server-side.
const SYSTEM_PROMPT = `You build chart configurations for a GBIF biodiversity dashboard.

Given a natural-language query, you MUST respond with a single JSON object containing exactly two string fields:
- "graphQuery": a GraphQL query against the GBIF occurrence search API
- "jqQuery": a jq program that transforms the GraphQL response into a Highcharts options object

Hard rules:
- Respond with ONLY the JSON object. No prose, no markdown, no code fences.
- The GraphQL query MUST accept a "$predicate: Predicate" variable and pass it to occurrenceSearch(predicate: $predicate). The current dashboard filters will be injected at runtime as that variable; you do not need to know their value.
- The jq output MUST be a valid Highcharts options object with at least a "series" array. Do NOT set "colors" — the host applies its own palette.
- Keep facet sizes reasonable (<= 50).

Facetable fields on occurrenceSearch:
collectionCode, continent, institutionCode, issue, lifeStage, countryCode, speciesKey, datasetKey, kingdomKey, year, basisOfRecord, mediaType, typeStatus

Example GraphQL shape:
query Breakdown($predicate: Predicate) {
  occurrenceSearch(predicate: $predicate) {
    facet {
      basisOfRecord(size: 20) { key count }
    }
  }
}

Highcharts pie example:
{
  "chart": { "type": "pie" },
  "title": { "text": "..." },
  "series": [{ "type": "pie", "name": "Occurrences", "colorByPoint": true, "data": [{ "name": "...", "y": 123 }] }]
}

Highcharts column example:
{
  "chart": { "type": "column" },
  "title": { "text": "..." },
  "xAxis": { "categories": ["a", "b"] },
  "series": [{ "type": "column", "name": "Occurrences", "data": [10, 20] }]
}

Highcharts time-series example:
{
  "chart": { "type": "line" },
  "title": { "text": "..." },
  "xAxis": { "title": { "text": "Year" } },
  "yAxis": { "title": { "text": "Occurrences" } },
  "series": [{ "type": "line", "name": "Occurrences", "data": [[2010, 10], [2011, 12]] }]
}
`;

export const mistralAgent: Agent = {
  name: 'mistral',
  isAvailable: () =>
    typeof config.mistralApiKey === 'string' && config.mistralApiKey.length > 0,
  async run({ query, queryId, apolloServer }) {
    if (!config.mistralApiKey) {
      throw new McpError('mistralApiKey is not configured in .env', 500);
    }

    let response: Response;
    try {
      response = await fetch(MISTRAL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.mistralApiKey}`,
        },
        body: JSON.stringify({
          model: config.mistralModel ?? DEFAULT_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: query },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: 2000,
        }),
      });
    } catch (error) {
      throw new McpError(
        `Mistral API request failed: ${(error as Error).message}`,
        502,
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new McpError(
        `Mistral API ${response.status}: ${body.slice(0, 500)}`,
        502,
      );
    }

    const data = (await response.json()) as {
      model?: string;
      usage?: unknown;
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || text.length === 0) {
      throw new McpError('Mistral returned no message content', 502);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new McpError(
        `Mistral output is not valid JSON: ${text.slice(0, 300)}`,
        502,
      );
    }

    const obj = parsed as { graphQuery?: unknown; jqQuery?: unknown };
    if (typeof obj.graphQuery !== 'string' || typeof obj.jqQuery !== 'string') {
      throw new McpError(
        'Mistral response missing string graphQuery or jqQuery',
        502,
      );
    }

    const { chartId } = await executeChart({
      graphQuery: obj.graphQuery,
      jqQuery: obj.jqQuery,
      queryId,
      apolloServer,
    });

    return {
      provider: 'mistral',
      chartId,
      raw: {
        model: data.model,
        usage: data.usage,
        graphQuery: obj.graphQuery,
        jqQuery: obj.jqQuery,
      },
    };
  },
};
