import type { ErrorRequestHandler, Request, Response } from 'express';
import config from '../config';
import logger from '../logger';

/**
 * Catch-all 404 for any request that fell through every route above. Mount this
 * after all routes but before {@link errorHandler}. Returns the same JSON shape
 * as the error handler so clients get a consistent body for both cases.
 */
export function notFoundHandler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
  });
}

/**
 * Final Express error handler. Express only recognises it as an error handler
 * because it declares four arguments, so the unused `next` must stay.
 *
 * It catches:
 *  - synchronous throws in handlers/middleware,
 *  - explicit `next(err)` calls,
 *  - rejected async handlers (via `express-async-errors` today, natively once
 *    we move to Express 5).
 *
 * Internal details (messages, stack traces) are only exposed when `debug` is
 * on, so production responses never leak upstream URLs or stack traces.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const status: number = err?.status || err?.statusCode || 500;

  logger[status >= 500 ? 'error' : 'warn']({
    message: 'Express request error',
    status,
    method: req.method,
    path: req.path,
    err: { message: err?.message, stack: err?.stack },
  });

  // If the response has already started streaming we can't change the status or
  // body; hand off to Express's built-in handler, which closes the connection.
  if (res.headersSent) {
    next(err);
    return;
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.status(status).json({
    error: status >= 500 ? 'Internal Server Error' : err?.message || 'Error',
    ...(config.debug
      ? { message: err?.message, stack: err?.stack }
      : {}),
  });
};
