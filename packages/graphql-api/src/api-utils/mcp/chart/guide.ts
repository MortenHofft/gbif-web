import { CHART_KNOWLEDGE } from './agents/sharedPrompt';

export const USAGE_TOKEN = 'I_HAVE_READ_THE_GUIDELINES';

// Returned by the MCP `gbif_usage_guidelines` tool. Same schema/example
// knowledge as the direct-call system prompt (see ./agents/sharedPrompt.ts),
// wrapped with instructions for calling the `create_visualization` MCP tool
// instead of "respond with JSON".
export const SEARCH_GUIDE = `# GBIF Chart Guide

Read this before calling \`create_visualization\`. It explains how to build a chart for the GBIF occurrence dashboard: the GraphQL schema, the jq transform, and the expected Highcharts output shape.

${CHART_KNOWLEDGE}

# Calling create_visualization

After preparing your graphQuery and jqQuery, call the \`create_visualization\` tool with:
- usageToken: "${USAGE_TOKEN}"
- queryId: the conversation/chart-store id from your system message
- graphQuery: your GraphQL query string
- jqQuery: your jq program string

# Usage token

The usageToken value you need: ${USAGE_TOKEN}
`;
