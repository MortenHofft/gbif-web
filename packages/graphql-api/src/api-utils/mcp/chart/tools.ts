import { ApolloServer } from 'apollo-server-express';
import { ExpressContext } from 'apollo-server-express/dist/ApolloServer';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SEARCH_GUIDE, USAGE_TOKEN } from './guide';
import { executeChart } from './executeChart';
import { McpError } from './errors';

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
        'Always read this before using GBIF data. Provides essential guidelines. This is also where you will find the usageToken needed for the other tools. The query parameter is required.',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: guidelinesInput as any,
    },
    async () => ({
      content: [{ type: 'text' as const, text: SEARCH_GUIDE }],
    }),
  );

  const createVizInput = {
    usageToken: z
      .string()
      .describe(
        'This token is required to use the tool (obtain from gbif_usage_guidelines).',
      ),
    queryId: z
      .string()
      .min(1)
      .describe(
        'The conversation chart-store id provided to you in this session. Pass it unchanged on every call.',
      ),
    graphQuery: z
      .string()
      .min(1)
      .describe(
        'A required GraphQL query to fetch the data needed for the chart. The result is piped through jqQuery before being interpreted as Vega-Lite.',
      ),
    jqQuery: z
      .string()
      .min(1)
      .describe(
        'A required jq query that transforms the GraphQL response into a Vega-Lite spec (must include $schema).',
      ),
  };

  server.registerTool(
    'create_visualization',
    {
      description:
        'Create a chart from species occurrence records. The jq result must be a valid Vega-Lite v5 spec. Read gbif_usage_guidelines first. Supports faceting for aggregated counts by dimension.',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      inputSchema: createVizInput as any,
    },
    async (args: unknown) => {
      const { usageToken, queryId, graphQuery, jqQuery } = args as {
        usageToken: string;
        queryId: string;
        graphQuery: string;
        jqQuery: string;
      };

      if (usageToken !== USAGE_TOKEN) {
        throw new McpError(
          'You must provide a valid usageToken to use this tool. Obtain it from the gbif_usage_guidelines tool.',
          400,
        );
      }

      const { chartId } = await executeChart({
        graphQuery,
        jqQuery,
        queryId,
        apolloServer,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Chart configuration saved with ID: ${chartId}`,
          },
        ],
      };
    },
  );
}
