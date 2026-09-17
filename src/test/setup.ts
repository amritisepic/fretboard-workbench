/**
 * Vitest setup, loaded for every test file (vite.config.ts).
 *
 * Most tests run in Node, so everything that needs a document is behind a guard and only takes
 * effect in the files that ask for jsdom with a `@vitest-environment jsdom` docblock.
 */

import { afterEach } from 'vitest';

if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  afterEach(cleanup);

  // jsdom has no layout engine, so anything that measures gets zeros. Components that measure
  // (useFitToFrame, useRowStarts, the export sheet) cope with that; these stubs only keep the
  // browser APIs they call from being undefined, which would throw on mount.
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}
