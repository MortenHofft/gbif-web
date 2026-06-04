import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginCacheControl } from '@apollo/server/plugin/cacheControl';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express4';
import { InMemoryLRUCache } from '@apollo/utils.keyvaluecache';
import bodyParser from 'body-parser';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
// Side-effect import: routes rejected promises from async Express handlers to
// the error-handling middleware. Express 4 does not do this natively; remove
// this once we upgrade to Express 5, which handles it built-in.
import 'express-async-errors';
import http from 'node:http';
import { get } from 'lodash';
import { setMaxListeners } from 'node:events';
// recommended in the apollo docs https://github.com/stems/graphql-depth-limit
import depthLimit from 'graphql-depth-limit';

// Local imports
import config from './config';
import createContext from './createContext';
import health from './health';
import { graphqlExplorer, hashMiddleware } from './middleware';
// get the full schema of what types, enums, scalars and queries are available
import getSchema from './typeDefs';
// define how to resolve the various types, fields and queries
import resolvers from './resolvers';
// we will attach a user if an authorization header is present.
import feedbackController from './api-utils/forms/feedback';
import citesController from './api-utils/cites.ctrl';
import formController from './api-utils/forms/index.ctrl';
import geometryController from './api-utils/geometry/index.ctrl.js';
import helperController from './api-utils/helpers.ctrl.js';
import vsearchCtrl from './api-utils/vsearch.ctrl.js';
import ipController from './api-utils/ip2country.ctrl.js';
import mapController from './api-utils/maps/index.ctrl.js';
import polygonName from './api-utils/polygonName.ctrl.js';
import sourceArchiveCtrl from './api-utils/sourceArchive.ctrl.js';
import extractUser from './helpers/auth/extractUser';
import overloadGuard from './overloadGuard';
import { explicitNoCacheWhenErrorsPlugin } from './plugins/explicitNoCacheWhenErrorsPlugin';
import headerBasedCachePlugin from './plugins/headerBasedCachePlugin';
import loggingPlugin from './plugins/loggingPlugin';
import { errorHandler, notFoundHandler } from './middleware';
import installLifecycleHandlers from './gracefulShutdown';
import logger from './logger';

// we are doing this async as we need to load the various enumerations from the APIs
// and generate the schema from those
async function initializeServer() {
  // this is async as we generate parts of the schema from the live enumeration API
  const typeDefs = await getSchema();

  // Create the Express app and a real http.Server up front so the Apollo drain
  // plugin can hook the same server we listen on (see plugins below + graceful
  // shutdown at the end of this function).
  const app = express();
  const httpServer = http.createServer(app);

  const server = new ApolloServer({
    cache: new InMemoryLRUCache(),
    typeDefs,
    resolvers,
    // Keep introspection enabled in all environments so the self-hosted GraphiQL
    // sandbox (served from public/graphql-sandbox.html) can fetch the schema.
    introspection: true,
    // Apollo Server 4+ enables CSRF prevention by default, which blocks "simple"
    // GET requests that lack a JSON content-type (e.g. pasting a /graphql?query=
    // URL in the browser, shared query links, the loggingPlugin playgroundLink).
    // We intentionally support GET-by-URL (it powers our GET caching), and the
    // API authenticates via the Authorization header / JWT rather than cookies,
    // so the CSRF vector (ambient cookie credentials) does not apply. Disabling
    // it restores the apollo-server v3 behaviour.
    csrfPrevention: false,
    validationRules: [depthLimit(14)], // this likely have to be much higher than 6, but let us increase it as needed and not before
    plugins: [
      // We serve our own GraphiQL sandbox via the graphqlExplorer middleware,
      // so disable Apollo's built-in landing page.
      ApolloServerPluginLandingPageDisabled(),
      ApolloServerPluginCacheControl({
        defaultMaxAge: config.debug ? 0 : 603,
      }),
      loggingPlugin,
      headerBasedCachePlugin,
      explicitNoCacheWhenErrorsPlugin,
      // Drains in-flight GraphQL operations and closes the HTTP server on
      // server.stop() (called from graceful shutdown). Owns HTTP draining so we
      // don't close httpServer ourselves.
      ApolloServerPluginDrainHttpServer({ httpServer }),
    ],
    logger: console,
  });

  // The per-request context. In Apollo Server 4+ the `dataSources` and `context`
  // constructor options were removed; data sources are now created inside the
  // context function (see createContext) and exposed on the returned object.
  const context = async ({ req, res }: { req: express.Request; res: express.Response }) => {
    // on all requests attach a user if present
    const user = await extractUser(get(req, 'headers.authorization'));
    if (user) {
      // it isn't possible to set cache headers on the response object here as the cache control headers will be overwritten by the apollo cache plugin
      // res.header(
      //   'Cache-Control',
      //   'private, no-cache, no-store, must-revalidate',
      // );
      res.header('Pragma', 'no-cache');
      res.header('Expires', '0');
      res.header('Surrogate-Control', 'no-store');
    }

    // Add express context and a listener for aborted connections. Then data sources have a chance to cancel resources
    // I haven't been able to find any examples of people doing anything with cancellation - which I find odd.
    // Perhaps the overhead isn't worth it in most cases?
    const controller = new AbortController();
    // Default is 10, we exceed this sometimes with nested resolves that utilize cancellation
    setMaxListeners(100, controller.signal);
    if (req) {
      req.on('close', () => {
        controller.abort();
      });
    }

    return createContext({
      user,
      abortController: controller,
      userAgent: get(req, 'headers.User-Agent') || 'GBIF_GRAPHQL_API',
      // we could also forward the full header I suppose. For now it is just the referer
      referer: get(req, 'headers.referer') || null,
      locale: get(req, 'headers.locale') || 'en-GB',
      preview: get(req, 'headers.preview') === 'true',
      queryId: res ? res.get('X-Graphql-query-ID') : null,
      variablesId: res ? res.get('X-Graphql-variables-ID') : null,
    });
  };

  app.use(compression());
  app.use(
    cors({
      methods: 'GET,POST,OPTIONS',
    }),
  );
  // Shed load (fast 503) before the expensive per-request work — body parsing,
  // GraphQL parse/validate, context build. Only guards configured paths
  // (default /graphql) and never /health. No-op unless enabled in config.
  app.use(overloadGuard);
  app.use(express.static('public'));
  app.use(bodyParser.json({ limit: '1mb' }));

  // extract query and variables from store if a hash is provided instead of a query or variable
  // app.use(hashMiddleware);
  app.get('/graphql', hashMiddleware);
  app.post('/graphql', hashMiddleware);

  // serve the graphql explorer
  app.get('/graphql', graphqlExplorer);

  // link to query and variables
  app.get('/getIds', (req, res) => {
    res.json({
      queryId: res.get('X-Graphql-query-ID'),
      variablesId: res.get('X-Graphql-variables-ID'),
    });
  });

  app.get('/health', health);

  // Apollo Server 4+ requires start() to be awaited before mounting the middleware.
  await server.start();
  // Mounts on /graphql, after the hash + explorer middleware registered above.
  // cors() and bodyParser.json() are already applied globally on `app`.
  app.use('/graphql', expressMiddleware(server, { context }));
  feedbackController(app);
  mapController(app);
  ipController(app);
  polygonName(app);
  formController(app);
  geometryController(app);
  helperController(app, server);
  vsearchCtrl(app);
  sourceArchiveCtrl(app);
  citesController(app);

  // Must come after every route. The 404 handler catches unmatched paths; the
  // error handler is the single place that turns thrown/rejected/next(err)
  // errors from any Express route (GraphQL and non-GraphQL alike) into a logged,
  // consistent JSON response.
  app.use(notFoundHandler);
  app.use(errorHandler);

  // Align keep-alive timeouts with typical load balancers: headersTimeout must
  // be greater than keepAliveTimeout, and both should exceed the LB idle timeout
  // to avoid races that surface as sporadic 502s.
  httpServer.keepAliveTimeout = 65_000;
  httpServer.headersTimeout = 66_000;

  httpServer.listen({ port: config.port }, () =>
    console.log(
      `🚀 Server ready at http://localhost:${config.port}/graphql`,
    ),
  );

  // Wire process-level crash handlers + graceful shutdown for the whole app.
  installLifecycleHandlers({ apolloServer: server, httpServer });
}

initializeServer().catch((err) => {
  // A boot failure (e.g. the live enumeration API used to build the schema is
  // unreachable) should fail loudly and exit non-zero so the orchestrator can
  // retry, rather than surface as an opaque unhandled rejection.
  logger.error({
    message: 'Failed to initialize server',
    err: { message: err?.message, stack: err?.stack },
  });
  process.exit(1);
});
