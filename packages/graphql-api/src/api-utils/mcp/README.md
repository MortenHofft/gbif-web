# `mcp/` — chart agent + an MCP example

Historically this folder hosted [Model Context Protocol] endpoints; the chart
feature has since switched to direct-call LLM agents and no longer exposes an
MCP surface. The folder name is kept for now to avoid churn on import paths.

[Model Context Protocol]: https://modelcontextprotocol.io/

## What's here

- **`chart/`** — the custom-chart feature for the occurrence dashboard. Three
  REST routes (`POST /mcp/chart/query`, `GET /mcp/chart/key/:key`,
  `POST /mcp/chart/key/:key/refresh`) backed by a pluggable LLM agent
  registry (mistral, groq, gemini, mock). See [`chart/README.md`](./chart/README.md).
- **`helloWorld.ctrl.ts`** — a minimal MCP server at `/mcp/hello-world`.
  Reference implementation for the Model Context Protocol; one tool that
  echoes a greeting. Useful for smoke-testing MCP-client integrations.

## Adding a new MCP server (if you want one)

The hello-world controller is the template:

1. Build an `McpServer` instance per HTTP request (stateless transport) and
   register its tools.
2. Mount it on Express via `StreamableHTTPServerTransport` at a fresh
   `/mcp/<name>` path.
3. Add an Origin / Host DNS-rebinding guard, optional bearer-token auth, and
   `405` handlers for `GET`/`DELETE` (per the MCP spec).
