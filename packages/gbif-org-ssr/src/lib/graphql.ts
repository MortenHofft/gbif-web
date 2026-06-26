// Isomorphic GraphQL client — the SAME module is imported by server loaders and by
// client islands (bundled for the browser by esbuild). Node 22 and modern browsers
// both provide global fetch, so there is one implementation for both.
//
// This is a trimmed port of packages/gbif-org/src/services/graphQLService.ts.
// That version adds a GET-by-query-hash fast path (for CDN/edge caching) + a fragment
// manager; this slice is POST-only to stay dependency-free. Port the GET path here
// once the architecture is approved — the `.query(query, variables)` shape is kept
// identical so it's a drop-in upgrade.
export type GqlResult<TData> = {
  data: TData;
  errors?: Array<{ message: string; path?: Array<string | number> }>;
};

export class GraphQLService {
  constructor(
    private readonly opts: { endpoint: string; locale?: string; signal?: AbortSignal }
  ) {}

  async query<TData, TVars extends Record<string, unknown> = Record<string, unknown>>(
    query: string,
    variables?: TVars
  ): Promise<GqlResult<TData>> {
    const res = await fetch(this.opts.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.opts.locale ? { locale: this.opts.locale } : {}),
      },
      body: JSON.stringify({ query, variables }),
      signal: this.opts.signal,
    });
    if (!res.ok) {
      throw new Error(`GraphQL request failed: HTTP ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as GqlResult<TData>;
  }
}
