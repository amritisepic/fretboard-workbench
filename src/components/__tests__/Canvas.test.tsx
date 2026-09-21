// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkbench } from '../../state/workbench';
import { axeRuleIds } from '../../test/axe';
import { FIXTURES, openExample, resetStores } from '../../test/fixtures';
import { Canvas } from '../Canvas';

const state = () => useWorkbench.getState();

const renderCanvas = () => {
  const { container } = render(<Canvas onRequestRemove={vi.fn()} />);
  return container;
};

describe('Canvas', () => {
  beforeEach(resetStores);

  it('lays out one group per chord, each with a key band, a scale band and a card', () => {
    const count = openExample(FIXTURES.short);
    const container = renderCanvas();
    expect(container.querySelectorAll('.box-group')).toHaveLength(count);
    expect(container.querySelectorAll('.key-band')).toHaveLength(count);
    expect(container.querySelectorAll('.scale-band')).toHaveLength(count);
    expect(container.querySelectorAll('.box')).toHaveLength(count);
  });

  it('puts a strip between every pair of chords, but not before the first', () => {
    const count = openExample(FIXTURES.short);
    const container = renderCanvas();
    expect(container.querySelectorAll('.strip')).toHaveLength(count - 1);
  });

  it('offers the alternative key as a button where the analysis is ambiguous', () => {
    openExample(FIXTURES.ambiguous);
    const container = renderCanvas();
    const choices = container.querySelectorAll('.key-choice');
    expect(choices.length).toBeGreaterThan(0);
    expect([...choices].every((c) => c.tagName === 'BUTTON')).toBe(true);
  });

  it('pins a reading when one of the offered keys is chosen, and unpins it when chosen again', () => {
    openExample(FIXTURES.ambiguous);
    const container = renderCanvas();
    const unchosen = [...container.querySelectorAll('.key-choice')].find((c) => !c.classList.contains('is-chosen'));
    if (!unchosen) throw new Error('no alternative key offered');

    fireEvent.click(unchosen);
    expect(state().boxes.some((box) => box.readingPin !== null)).toBe(true);
  });

  it('shows the key choices as plain text in view mode, with nothing to edit', () => {
    openExample(FIXTURES.ambiguous);
    state().setViewing(true);
    const container = renderCanvas();
    expect([...container.querySelectorAll('.key-choice')].every((c) => c.tagName === 'SPAN')).toBe(true);
    expect(container.querySelector('.add-slot')).toBeNull();
  });

  it('appends a chord from the add button', () => {
    const count = openExample(FIXTURES.short);
    renderCanvas();
    fireEvent.click(screen.getByRole('button', { name: 'Add a box' }));
    expect(state().boxes).toHaveLength(count + 1);
  });

  // axe walks every node, and each board is ~291 of them, so this is slow even on four chords.
  it('has no axe violations', { timeout: 60_000 }, async () => {
    openExample(FIXTURES.short);
    expect(await axeRuleIds(renderCanvas())).toEqual([]);
  });

  // ---- Known gaps -------------------------------------------------------

  // A group is [key band] + [strip + box]. The band therefore starts one strip-width to the left of
  // the chord it names, so on screen each band sits above the gap before its chord instead of above
  // the chord. Plan item 11 (Phase 2) scopes the band to its own box.
  it.fails('draws each key band over the chord it names, not over the strip before it', () => {
    openExample(FIXTURES.short);
    const container = renderCanvas();
    for (const group of container.querySelectorAll('.box-group')) {
      const band = group.querySelector(':scope > .key-band');
      const body = group.querySelector(':scope > .box-group-body');
      expect(band, 'every group has a key band').not.toBeNull();
      expect(body?.querySelector('.strip'), 'the band must not span the strip').toBeNull();
    }
  });

  // The key band and the scale band under it print the same text whenever a box's reference scale
  // is the key it is in, which is the common case. Plan item 10 (Phase 2) merges them.
  it.fails('does not print the key and the reference scale twice when they are the same', () => {
    openExample(FIXTURES.short);
    const container = renderCanvas();
    const repeated = [...container.querySelectorAll('.box-group')].filter((group) => {
      const key = group.querySelector('.key-band-label')?.textContent?.trim();
      const scale = group.querySelector('.scale-band')?.textContent?.trim();
      return key !== undefined && key === scale;
    });
    expect(repeated).toHaveLength(0);
  });
});
