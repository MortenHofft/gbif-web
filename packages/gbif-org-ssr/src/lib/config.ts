// Central runtime config. Endpoints default to the public GBIF GraphQL API so the
// slice runs with zero setup; override via env (PUBLIC_* names mirror gbif-org).
export const config = {
  // Used by the server (loaders) to fetch data during SSR.
  graphqlEndpoint: process.env.PUBLIC_GRAPHQL_ENDPOINT ?? 'https://graphql.gbif.org/graphql',
  // Used by client islands (browser fetch). Defaults to the same-origin proxy
  // (/api/graphql) so the browser never needs CORS to GBIF and we can cache server-side.
  graphqlEndpointClient: process.env.PUBLIC_GRAPHQL_ENDPOINT_CLIENT ?? '/api/graphql',
  defaultLocale: process.env.PUBLIC_DEFAULT_LOCALE ?? 'en',
  port: parseInt(process.env.PORT ?? '3100', 10),
  isProduction: process.env.NODE_ENV === 'production',
};
