// gbif-web's vitest runs without `globals: true`, so use the vitest entrypoint
// which extends vitest's own `expect` instead of relying on a global one.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Without `globals: true`, Testing Library doesn't auto-register its between-test
// DOM cleanup, so renders would otherwise accumulate. Register it explicitly.
afterEach(() => cleanup());

// jsdom doesn't implement the Clipboard API; provide a stub so tests can spy on it
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: async () => {} },
  writable: true,
  configurable: true,
});

// jsdom doesn't implement ResizeObserver, which cmdk uses internally
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom doesn't implement scrollIntoView, which cmdk calls when items become active
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
