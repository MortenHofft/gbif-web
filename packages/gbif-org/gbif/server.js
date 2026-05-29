import { createServer as createHttpServer } from 'node:http';
import { merge } from 'ts-deepmerge';
import { loadEnv } from 'vite';
import logger from './config/logger.mjs';
import { configureApp } from './createApp.mjs';

// Load environment variables from .env files and merge them with process.env.
const envFile = loadEnv('', process.cwd(), ['PUBLIC_']);
const env = merge(envFile, process.env);

const IS_PRODUCTION = env.NODE_ENV === 'production';
const PORT = parseInt(env.PORT || 3000);

async function main() {
  const express = (await import('express')).default;
  const app = express();
  // Share a single HTTP server between Express and Vite's HMR. Without this, Vite's
  // middleware mode spins up its own server for HMR on a different port, and the
  // browser-side HMR client can't reach it — repeated WS reconnect failures cause
  // @vite/client to fall back to full reloads in a loop when PORT is not the default.
  const httpServer = createHttpServer(app);

  // Set up the Vite dev server in middleware mode for development. In production the
  // pre-built client/server bundles are used instead (see configureApp).
  let viteDevServer;

  if (!IS_PRODUCTION) {
    const vite = await import('vite');

    viteDevServer = await vite.createServer({
      root: process.cwd(),
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
      },
      appType: 'custom',
      configFile: './gbif/vite.config.ts',
    });
  }

  await configureApp(app, { isProduction: IS_PRODUCTION, viteDevServer });

  httpServer.listen(PORT, () => {
    logger.info('Server started successfully', { port: PORT, environment: env.NODE_ENV });
  });

  process.on('unhandledRejection', function (reason, p) {
    logger.logError(new Error('Unhandled Promise Rejection'), {
      reason: reason?.toString(),
      promise: p?.toString(),
    });
    // There is not much else to do here. Keep track of the logs and make sure this never happens. There should be no unhandled rejections.
  });
  process.on('uncaughtException', function (err) {
    // eslint-disable-next-line no-console
    console.error('FATAL: Uncaught exception.');
    console.error(err.stack || err);
    setTimeout(function () {
      process.exit(1);
    }, 200);
    // log.error('FATAL: Uncaught exception.');
    // log.error(err.stack || err);
  });
}

main();
