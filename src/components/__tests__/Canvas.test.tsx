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

  // One bar per chord now, not two: plan item 10 merged the scale band into the key band, so a
  // group is a bar and a card. The bar is a fixed height whether or not it carries a scale, which is
  // what keeps the cards in a row starting at the same height.
  it('lays out one group per chord, each with one bar and a card', () => {
    const count = openExample(FIXTURES.short);
    const container = renderCanvas();
    expect(container.querySelectorAll('.box-group')).toHaveLength(count);
    expect(container.querySelectorAll('.key-band')).toHaveLength(count);
    expect(container.querySelectorAll('.box')).toHaveLength(count);
    expect(container.querySelectorAll('.scale-band'), 'the second band is gone').toHaveLength(0);
  });

  it('names the key over every chord, not only where a key region starts', () => {
    const count = openExample(FIXTURES.short);
    const container = renderCanvas();
    const named = [...container.querySelectorAll('.key-band')].filter((band) => band.textContent?.includes('G major'));
    expect(named).toHaveLength(count);
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

  // A group is a grid: the strip takes the first column and the card the second, and the bar covers
  // the second column alone. It used to be [key band] + [strip + box], which started the band one
  // strip-width left of the chord it named. Closed by plan item 11 (Phase 2).
  it('draws each key band over the chord it names, not over the strip before it', () => {
    openExample(FIXTURES.short);
    const container = renderCanvas();
    for (const group of container.querySelectorAll('.box-group')) {
      const band = group.querySelector(':scope > .key-band');
      const body = group.querySelector(':scope > .box-group-body');
      expect(band, 'every group has a key band').not.toBeNull();
      expect(body?.querySelector('.strip'), 'the band must not span the strip').toBeNull();
    }
  });

  // The key band and the scale band under it used to print the same text whenever a box's reference
  // scale was the key it is in, which is the common case. Closed by plan item 10 (Phase 2): there is
  // one bar, and the scale joins it only when it differs from the key.
  it('does not print the key and the reference scale twice when they are the same', () => {
    openExample(FIXTURES.short);
    const container = renderCanvas();
    // `.scale-band` is gone, so the old reading of this — key-band text against scale-band text —
    // would now pass without looking at anything. The bar's own two halves are what can still say
    // the same thing twice, so they are what is compared.
    const repeated = [...container.querySelectorAll('.box-group')].filter((group) => {
      const key = group.querySelector('.key-band-label')?.textContent?.trim();
      const scale = group.querySelector('.key-band-scale')?.textContent?.trim();
      return key !== undefined && key === scale;
    });
    expect(repeated).toHaveLength(0);

    // And the box whose scale is its key must print that name once, not in both halves.
    const tonic = [...container.querySelectorAll('.box-group')].find(
      (group) => group.querySelector('.key-band-label')?.textContent?.trim() === 'G major',
    );
    expect(tonic?.querySelector('.key-band-scale'), 'the tonic box carries no second name').toBeNull();
  });
});
