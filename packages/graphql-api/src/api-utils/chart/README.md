# Custom chart agent

Turns a natural-language question about GBIF occurrence data into either a
chart or a map that renders on the occurrence dashboard. Used by the
**"Custom chart"** card the user picks from the dashboard's "Add new"
dropdown.

```
user types  ─►  POST /chart/query  ─►  chart agent (LLM)
                                        │
                                        │ emits { kind, graphQuery, jqQuery }
                                        │   kind = "highcharts" | "geojson"
                                        ▼
                                      run GraphQL  ─►  pipe through jq
                                                          │
                                                          ▼
                                              validate output for kind:
                                              - Highcharts options object
                                              - GeoJSON FeatureCollection
                                                with simplestyle-spec
                                                          │
                                                          ▼
                                                stored in chart cache
                                        │
            ◄────────── queryId + entry◄┘
                          │
GET /chart/key/:id  ─────►│  used by Custom.tsx; renders either a
                          │  HighchartsReact chart or a MapView (OpenLayers)
                          │  based on entry.kind.
```

## Why this shape?

The most cost-effective way to let an LLM build a data visualisation is
**don't let the data through the LLM**. The model only writes a `graphQuery`
(against the existing GBIF GraphQL schema) and a `jqQuery` (a small jq
program that shapes the response into a Highcharts options object). Everything
in between runs server-side. For dashboard-scale data this is 100–1000×
cheaper than data-in-context approaches.

It's also reproducible — the `(graphQuery, jqQuery)` pair *is* the chart's
source. That's what powers the refresh-with-current-filters and
restore-original-filters controls on the Custom chart card.

## Endpoints

All three routes are open (the dashboard is the only intended caller):

- `POST /chart/query` — body `{ q, predicate }`. Runs the configured chart
  agent and returns `{ queryId, charts, llm }`.
- `GET /chart/key/:key` — returns the saved chart config. `:key=_list`
  returns all known keys.
- `POST /chart/key/:key/refresh` — body `{ predicate }`. Re-runs the stored
  `graphQuery + jqQuery` against the new predicate and replaces the
  rendered chart. The ChartConfig's original predicate is preserved so the
  client can offer "restore original".

## Module layout

```
chart/
├── chart.ctrl.ts        Express routes (POST query, GET key, POST refresh)
├── agent.ts             Dispatcher; picks an agent by config.chartAgent
├── agents/
│   ├── types.ts         Agent interface
│   ├── mock.ts          Canned basisOfRecord pie (zero-config fallback)
│   ├── mistral.ts       Mistral La Plateforme
│   ├── groq.ts          Groq (Llama / Gemma)
│   ├── gemini.ts        Google AI Studio
│   ├── openaiCompat.ts  Shared call helper for OpenAI-shape providers
│   ├── llmCall.ts       Provider-agnostic ChatMessage + runWithRetry +
│   │                    corrective-feedback builder
│   ├── runChartFromJson.ts  Parse model output → run pipeline → AgentResult
│   └── sharedPrompt.ts  CHART_KNOWLEDGE + CHART_SYSTEM_PROMPT
├── executeChart.ts      runChart (the pipeline), executeChart (append),
│                        refreshChart (replace)
├── store.ts             In-memory ChartConfig cache (NodeCache, 20-min TTL)
└── errors.ts            McpError with status + structured details
```

## Configuration

Set in `packages/graphql-api/.env` (YAML). All keys are optional except the
provider API keys for whichever agent you want to use.

| Key | Default | Notes |
| --- | --- | --- |
| `chartAgent` | `mock` | One of `mock`, `debug`, `mistral`, `groq`, `gemini`. See "Debug agent" below. |
| `chartAgentMaxAttempts` | `2` | 1 = no retry, 2 = one corrective retry, etc. |
| `mistralApiKey` / `mistralModel` | / `mistral-small-latest` | |
| `groqApiKey` / `groqModel` | / `llama-3.3-70b-versatile` | |
| `geminiApiKey` / `geminiModel` | / `gemini-flash-latest` | |
| `geminiMaxOutputTokens` | `8000` | Thinking + visible tokens share this budget. |
| `geminiThinkingBudget` | `0` (off) | `-1` dynamic, positive integer = cap. |

If the selected `chartAgent` is missing its API key the dispatcher logs a
warning and falls back to `mock`, so the server still boots cleanly.

## Agent diagnostics

On any failure the controller returns:

```
{ "message": "<one-liner>", "details": { provider, model, usage, stage,
                                          graphQuery, jqQuery, variables,
                                          ...stage-specific extras } }
```

`stage` is one of `agent-empty`, `agent-json-parse`, `agent-shape`, `graphql`,
`jq`, `parse-jq-output`, `highcharts`, `geojson`. The same payload is logged
to the api server console so dev tails see what the agent actually produced.

The retry loop builds a corrective user message from these details — see
`agents/llmCall.ts`'s `stageFeedbackers`. Per-stage hints live next to the
stage they describe; adding a new one is a single entry in the dispatch
table.

## Debug agent

`chartAgent: debug` selects a deterministic agent that returns canned
LLM responses for testing the pipeline's error handling. Token cost zero,
latency near zero, every retry hint / JSON-recovery branch / graphQuery
auto-repair / downstream validator runs end-to-end.

Pick a scenario by typing its name directly in the Custom chart card —
e.g. `graphql-error`. The `debug:` prefix is optional. Unknown or missing
names default to `ok` (with a warning logged to the server console).
Current scenarios (defined in `agents/debug.ts`):

| Scenario | Tests |
| --- | --- |
| `ok` | Successful basisOfRecord pie chart. |
| `graphql-error` | Facet with `sortBy` (schema validation failure). |
| `jq-single-quotes` | jq strings with `'...'` (triggers our single-quote feedback). |
| `jq-no-parens` | `{ name: .label // .key }` (triggers our `//` parens feedback). |
| `missing-brace` | graphQuery missing a closing `}` (auto-repair should succeed). |
| `bad-json-recoverable` | JSON + trailing `}` (extract-first-object should recover). |
| `bad-json-unrecoverable` | Plain English; `agent-json-parse` fires. |
| `bad-shape` | `jqQuery` as a nested object (triggers `agent-shape`). |
| `invalid-highcharts` | jq output missing `series` / `chart`. |
| `empty` | Empty response (`agent-empty`). |

To add a scenario, append to the `SCENARIOS` map in `agents/debug.ts`.

---

# Roadmap — curated chart templates

Today every dashboard search goes through the LLM. That's fine for a research
preview, but the long-term shape is a **template-first** library that grows
from real usage and only falls back to the LLM for the long tail.

## Why

- **Cost decay over time.** Most dashboard charts are facet pies, facet
  columns, time series, and a handful of "X per Y" nested-facet shapes. As
  the template library grows, fewer queries hit the (paid, slow, occasionally
  wrong) LLM path. Each curated template is a frozen chart that's been
  validated once; serving it later is free.
- **Reliability.** A curated template is one we know renders. The LLM path
  can produce subtly broken jq or pick the wrong field, even with retries.
- **Trust.** Users see chart titles and labels chosen by an editor, not by
  an LLM that occasionally misspells `decimalLatitude` as `descimalLatitude`.

## Sketch of the lifecycle

```
query ──► embed ──► nearest template? ──┬── yes ──► run template (cheap, fast)
                                        │
                                        └── no ───► LLM pipeline (slow path)
                                                     │
                                                     ├──► render chart for user
                                                     │
                                                     └──► store as candidate
                                                            │
                                                            └──► (N similar
                                                                  queries
                                                                  across users)
                                                                  ──► admin
                                                                      review
                                                                      queue
                                                                        │
                                                                        ├── approve ──► global template
                                                                        └── reject ──► debugging signal
```

## What the data is, today

Right now everything lives in an in-memory `NodeCache` (`./store.ts`) with a
20-minute TTL: `queryId → { predicate, query, charts: [{ chartOptions,
graphQuery, jqQuery, graphqlData, variables }] }`. That's the *measurement
instrument* version. Two things to do with it before moving to templates:

1. **Persist queries.** Append each `POST /chart/query` to a small log
   (Elasticsearch index, append-only JSONL, whatever fits the deployment).
   Fields: timestamp, user agent (or user id when available), `q`, `predicate`,
   the agent's `graphQuery` + `jqQuery`, success/failure stage, any error.
   This is the corpus that drives everything below.
2. **Admin review surface.** A small page that lists recent queries with
   their generated charts, sorted by how often a semantically-similar query
   has been seen. The reviewer can approve a chart "as-is" (literal trigger
   phrase → frozen `graphQuery + jqQuery`) or abstract a parameter out
   (e.g. lift `country` to a slot so the template covers `mediaType`,
   `basisOfRecord`, etc.).

This data is also genuinely useful on its own — it's a direct read on what
the GBIF community actually wants to see, that the existing preconfigured
charts on the dashboard don't already answer.

## Matching incoming queries to curated charts

Three options, in order of practicality:

1. **Embedding similarity.** Embed each template's trigger phrase(s) (one
   or many synonyms per template), embed the incoming query, cosine
   similarity. Sentence-transformers MiniLM runs locally in ~50ms, free per
   query. Threshold ~0.85 to count as a hit. Falls through to the LLM
   otherwise. This is the unsexy-but-right backbone — start here.
2. **Slot-extracting LLM.** A small model emits `{ template_id | null,
   params }`. More accurate but every query pays an LLM call even on the
   fast path. Loses most of the cost savings.
3. **Exact phrase match.** Cheap, brittle. Useful only as a sanity layer
   in front of (1).

## Parameterisation gap

An LLM-generated `(graphQuery, jqQuery)` for "breakdown by country"
hardcodes `country`. To promote it to a reusable template, *someone* has to
abstract `country` into a slot. Three honest paths:

- **Don't abstract; store the literal.** Trigger on the exact phrase only.
  Fast, dumb, fine if you're willing to grow the library one phrase at a time.
- **Admin abstracts at promotion time.** Slower but produces real templates.
  Probably right.
- **LLM abstracts on the way in.** Have the LLM emit both a parameterised
  template *and* a concrete instantiation. Admin's job becomes
  approve/reject instead of rewrite.

## Risks worth being clear about

- **Auto-promotion to all users is the part that goes wrong in production.**
  Showing untriaged LLM output to thousands of dashboard users is the
  classic "looks great in demo, embarrassing in the wild" mode. Default to
  *per-user candidate* scope; only roll up to global after popularity
  threshold + admin OK. Rejected popular candidates are the most useful
  debugging signal — they're where the LLM consistently produces
  plausible-but-wrong output.
- **Template menu has to be designed.** Templates aren't free — each one
  needs a graphQuery, a jq, axis sanity, and a way to be parameterised. The
  first 10 templates do most of the work; the next 90 are diminishing
  returns.
- **Schema drift.** If the GBIF GraphQL schema changes, every cached
  template and every cached LLM output is suddenly wrong. Templates are
  cheaper to fix because we own them; the LLM path "just retrains" with
  the next prompt change.

## What we have not built yet

Everything in this Roadmap section. The current code is the LLM path only —
the in-memory store is the seed of (1) above. Building templates is the
next chunk of work; the order is roughly:

1. Persist queries + outputs to durable storage.
2. Admin review page reading from that storage.
3. Embedding-based matcher with a small starter template library
   (facet-pie, facet-column, year-time-series, lat/long-scatter).
4. Auto-promotion rules with popularity threshold + admin gate.
