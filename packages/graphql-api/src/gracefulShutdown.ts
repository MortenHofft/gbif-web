import type { ApolloServer } from '@apollo/server';
import type { Server } from 'node:http';
import { get } from 'lodash';
import config from './config';
import logger from './logger';
import { markShuttingDown } from './lifecycle';

/**
 * Process-level safety net for the whole Express app (not just GraphQL).
 *
 * Wires up:
 *  - SIGTERM / SIGINT       -> graceful shutdown (drain in-flight, exit 0)
 *  - uncaughtException      -> log, drain briefly, exit 1 (process is now in an
 *                              undefined state; let the orchestrator restart a
 *                              clean one)
 *  - unhandledRejection     -> log only. A single stray rejection (e.g. an
 *                              aborted upstream request) shouldn't take down the
 *                              whole process. Express 5 will route async route
 *                              rejections to the error middleware instead.
 *
 * Draining itself is handled by ApolloServerPluginDrainHttpServer: calling
 * `apolloServer.stop()` stops accepting new connections, closes idle keep-alive
 * sockets, and waits for in-flight requests before resolving.
 */
export function installLifecycleHandlers({
  apolloServer,
  httpServer,
}: {
  apolloServer: ApolloServer;
  httpServer: Server;
}) {
  const shutdownTimeoutMs = Number(
    get(config, 'shutdown.timeoutMs', 10000),
  );

  let shutdownStarted = false;

  async function shutdown(reason: string, exitCode: number) {
    if (shutdownStarted) return;
    shutdownStarted = true;

    // Flip the flag first so /health starts returning 503 and the load balancer
    // stops routing new traffic to us while we drain.
    markShuttingDown();
    logger.info({ message: 'Shutdown initiated', reason });

    // Hard deadline: if draining hangs (stuck sockets, slow clients), exit anyway
    // rather than block the orchestrator's own kill timeout.
    const forceTimer = setTimeout(() => {
      logger.error({
        message: 'Graceful shutdown timed out; forcing exit',
        reason,
      });
      process.exit(exitCode || 1);
    }, shutdownTimeoutMs);
    forceTimer.unref();

    try {
      // Drains both GraphQL operations and the underlying HTTP server (via the
      // drain plugin), so we don't close httpServer ourselves and risk a
      // double-close.
      await apolloServer.stop();
      logger.info({ message: 'Graceful shutdown complete', reason });
      clearTimeout(forceTimer);
      process.exit(exitCode);
    } catch (err) {
      logger.error({ message: 'Error during graceful shutdown', reason, err });
      clearTimeout(forceTimer);
      process.exit(exitCode || 1);
    }
  }

  process.on('SIGTERM', () => {
    shutdown('SIGTERM', 0);
  });
  process.on('SIGINT', () => {
    shutdown('SIGINT', 0);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error({
      message: 'unhandledRejection',
      reason:
        reason instanceof Error
          ? { message: reason.message, stack: reason.stack }
          : reason,
    });
  });

  process.on('uncaughtException', (err) => {
    logger.error({
      message: 'uncaughtException',
      err: { message: err?.message, stack: err?.stack },
    });
    shutdown('uncaughtException', 1);
  });

  // Keep a reference so linters don't flag httpServer as unused; it documents
  // that the server's lifetime is owned here even though the drain plugin does
  // the actual closing.
  return { httpServer };
}

export default installLifecycleHandlers;
