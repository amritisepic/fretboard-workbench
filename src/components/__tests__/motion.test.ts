// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedMotion, scrollBehavior } from '../motion';

/** Stands in for the system setting, which jsdom always reports as "no preference". */
function saysReduce(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
  }));
}

describe('the reduced-motion preference', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('scrolls instantly when motion is unwelcome, and smoothly when it is not', () => {
    saysReduce(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(scrollBehavior()).toBe('auto');

    saysReduce(false);
    expect(prefersReducedMotion()).toBe(false);
    expect(scrollBehavior()).toBe('smooth');
  });

  it('is read at the moment of the movement, so changing the setting takes effect at once', () => {
    saysReduce(false);
    expect(scrollBehavior()).toBe('smooth');
    saysReduce(true);
    expect(scrollBehavior()).toBe('auto');
  });

  it('assumes motion is welcome where the question cannot be asked', () => {
    // The export sheet renders where there is no `matchMedia`; a throw there would take the export
    // down over a preference that cannot apply to a static page anyway.
    vi.stubGlobal('matchMedia', undefined);
    expect(prefersReducedMotion()).toBe(false);
    expect(scrollBehavior()).toBe('smooth');
  });
});
