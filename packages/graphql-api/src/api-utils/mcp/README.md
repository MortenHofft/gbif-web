# MCP endpoints

This folder exposes [Model Context Protocol] endpoints from the graphql-api
service. Each subfolder is one MCP "server" mounted at a distinct path on the
Express app and registered in `src/index.ts`.

[Model Context Protocol]: https://modelcontextprotocol.io/

## What's here

- **`helloWorld.ctrl.ts`** — a minimal MCP server at `/mcp/hello-world`.
  Reference implementation; one tool that echoes a greeting. Useful for
  smoke-testing MCP-client integrations.
- **`chart/`** — the chart MCP server at `/mcp/chart`, plus companion REST
  routes used by the occurrence dashboard to turn natural-language queries
  into Highcharts visualisations. See [`chart/README.md`](./chart/README.md).

## Adding a new MCP server

The pattern in both subfolders is the same:

1. Build an `McpServer` instance per HTTP request (stateless transport) and
   register its tools.
2. Mount it on Express via `StreamableHTTPServerTransport` at a fresh
   `/mcp/<name>` path.
3. Add the same Origin / Host DNS-rebinding guard, optional bearer-token
   auth, and `405` handlers for `GET`/`DELETE`.
4. If the feature has a UI surface, add companion REST routes on the same
   controller (this is what `chart/` does for the dashboard's "describe a
   chart" search box).

Each MCP server should ship its own README in the subfolder explaining its
domain. This file is the index.
