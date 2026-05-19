import { ApolloServer } from 'apollo-server-express';
import { ExpressContext } from 'apollo-server-express/dist/ApolloServer';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SEARCH_GUIDE } from './guide';
import { executeChart } from './executeChart';

export function registerChartTools(
  server: McpServer,
  apolloServer: ApolloServer<ExpressContext>,
): void {
  const guidelinesInput = {
    query: z
      .string()
      .min(1)
      .max(1000)
      .describe(
        'What is the user looking for? Translate the query into English if possible.',
      ),
  };

  server.registerTool(
    'gbif_usage_guidelines',
    {
      description:
        'Read this before calling create_visualization. Provides the GBIF schema, the jq + Highcharts output shape, and worked examples.',
      // The SDK's input-schema type is stricter than the Zod-raw-shape we
      // pass; runtime works fine, so cast through any.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: guidelinesInput as any,
    },
    async () => ({
      content: [{ type: 'text' as const, text: SEARCH_GUIDE }],
    }),
  );

  const createVizInput = {
    queryId: z
      .string()
      .min(1)
      .describe(
        'The conversation chart-store id provided to you in this session. Pass it unchanged on every call.',
      ),
    kind: z
      .enum(['highcharts', 'geojson'])
      .default('highcharts')
      .describe(
        '"highcharts" for a chart (Highcharts options object); "geojson" for a map (GeoJSON FeatureCollection with simplestyle-spec properties).',
      ),
    graphQuery: z
      .string()
      .min(1)
      .describe(
        'A GraphQL query to fetch the data needed for the visualization. The result is piped through jqQuery before being interpreted according to `kind`.',
      ),
    jqQuery: z
      .string()
      .min(1)
      .describe(
        'A jq program that transforms the GraphQL response into the output for the chosen kind. Strings MUST use double quotes.',
      ),
  };

  server.registerTool(
    'create_visualization',
    {
      description:
        'Create a chart or map from species occurrence records. The jq result must be either a valid Highcharts options object (kind=highcharts) or a GeoJSON FeatureCollection with simplestyle-spec properties (kind=geojson). Read gbif_usage_guidelines first for the schema, jq rules, and worked examples.',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: createVizInput as any,
    },
    async (args: unknown) => {
      const { queryId, kind, graphQuery, jqQuery } = args as {
        queryId: string;
        kind?: 'highcharts' | 'geojson';
        graphQuery: string;
        jqQuery: string;
      };

      await executeChart({
        graphQuery,
        jqQuery,
        kind: kind ?? 'highcharts',
        queryId,
        apolloServer,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `${kind ?? 'highcharts'} configuration saved with ID: ${queryId}`,
          },
        ],
      };
    },
  );
}
