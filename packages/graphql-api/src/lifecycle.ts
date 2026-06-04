/**
 * Tiny shared module that tracks whether the process has begun shutting down.
 *
 * Kept dependency-free and side-effect-free so it can be imported from both the
 * lifecycle handler (which flips the flag) and request handlers such as the
 * health check (which read it) without risking a circular import.
 */

let shuttingDown = false;

/** True once SIGTERM/SIGINT/uncaughtException has started a graceful shutdown. */
export function isShuttingDown(): boolean {
  return shuttingDown;
}

/** Called once when graceful shutdown begins. Idempotent. */
export function markShuttingDown(): void {
  shuttingDown = true;
}
