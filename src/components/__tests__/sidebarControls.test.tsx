// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkbench } from '../../state/workbench';
import { axeRuleIds } from '../../test/axe';
import { FIXTURES, openExample, resetStores } from '../../test/fixtures';
import { FillSwitch } from '../FillSwitch';
import { RankingList } from '../RankingList';
import { getBoxView } from '../boardModel';
import { buildRankingView } from '../rankingModel';
import { Sidebar } from '../Sidebar';

const state = () => useWorkbench.getState();

describe('FillSwitch', () => {
  beforeEach(resetStores);

  const renderSwitch = (mode: 'inversion' | 'scale' = 'inversion', on = true) => {
    const onSetMode = vi.fn();
    const onSetOn = vi.fn();
    const { container } = render(<FillSwitch fill={{ on, mode }} onSetOn={onSetOn} onSetMode={onSetMode} />);
    return { container, onSetMode, onSetOn, group: screen.getByRole('radiogroup', { name: 'Fill type' }) };
  };

  it('offers the two fill types as radios, with the one in use checked', () => {
    const { group } = renderSwitch('scale');
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['Fill inversion', 'Fill scale']);
    expect(radios[1]).toHaveProperty('ariaChecked', 'true');
  });

  it('moves between them with the arrow keys, as a radiogroup must', () => {
    const { group, onSetMode } = renderSwitch('inversion');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onSetMode).toHaveBeenCalledExactlyOnceWith('scale');
  });

  it('is a single tab stop', () => {
    const { group } = renderSwitch('scale');
    const stops = within(group).getAllByRole('radio').filter((r) => r.tabIndex >= 0);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveProperty('ariaChecked', 'true');
  });

  it('keeps the sliding track out of the accessibility tree, since it only repeats the options', () => {
    const { container, onSetMode, group } = renderSwitch('inversion');
    const track = container.querySelector('.fill-track');
    expect(track?.tagName).toBe('SPAN');
    expect(track?.getAttribute('aria-hidden')).toBe('true');
    // A radiogroup owns radios and nothing else, so the group must hold exactly two owned elements.
    expect(within(group).getAllByRole('radio')).toHaveLength(2);
    expect(within(group).queryAllByRole('button')).toEqual([]);

    // It still works for a pointer, which is all it is for.
    fireEvent.click(track as Element);
    expect(onSetMode).toHaveBeenCalledExactlyOnceWith('scale');
  });

  it('has no axe violations', async () => {
    const { container } = renderSwitch();
    expect(await axeRuleIds(container)).toEqual([]);
  });
});

describe('the harmony readings', () => {
  beforeEach(resetStores);

  /** The sidebar for the first box of an example whose analysis is ambiguous, so several readings show. */
  function renderSidebar() {
    openExample(FIXTURES.ambiguous);
    const box = state().boxes[0];
    state().selectBox(box.id);
    const { container } = render(<Sidebar box={box} />);
    return { container, box, list: screen.getByRole('list', { name: 'Readings of the chord' }) };
  }

  it('lists the readings as a real list, not as a radiogroup', () => {
    const { list } = renderSidebar();
    // A radio cannot be unchecked by pressing it again, and choosing the current reading here does
    // exactly that, so these are toggle buttons rather than radios. The sidebar's other groups —
    // Dot labels, Key at this box — really are radiogroups and are left alone.
    expect(list.getAttribute('role')).toBeNull();
    expect(list.querySelector('[role="radiogroup"], [role="radio"]')).toBeNull();
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(within(list).getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('pins a reading when it is chosen and unpins it when chosen again', () => {
    const { box, list } = renderSidebar();
    const options = within(list).getAllByRole('button');

    fireEvent.click(options[0]);
    const pinned = state().boxes.find((b) => b.id === box.id)?.readingPin;
    expect(pinned).not.toBeNull();

    // Re-rendered by the store change; ask again rather than reusing the old node.
    const again = within(screen.getByRole('list', { name: 'Readings of the chord' })).getAllByRole('button', {
      pressed: true,
    });
    expect(again).toHaveLength(1);
    fireEvent.click(again[0]);
    expect(state().boxes.find((b) => b.id === box.id)?.readingPin).toBeNull();
  });

  it('says in the button name what choosing it will do', () => {
    const { list } = renderSidebar();
    const options = within(list).getAllByRole('button');
    expect(options[0].getAttribute('aria-label')).toMatch(/^Read the chord as /);

    fireEvent.click(options[0]);
    const pinnedOption = within(screen.getByRole('list', { name: 'Readings of the chord' })).getAllByRole('button', {
      pressed: true,
    })[0];
    expect(pinnedOption.getAttribute('aria-label')).toMatch(/pinned\. Choose again/);
  });

  it('has no axe violations', async () => {
    const { container } = renderSidebar();
    expect(await axeRuleIds(container)).toEqual([]);
  });
});

describe('the scale ranking', () => {
  beforeEach(resetStores);

  /**
   * The ranking of a fixture's first box, as the sidebar builds it. The suggested scale is fed back
   * in from the ranking's own first row, so one row is marked without the test having to know which
   * scale the analyzer would pick for that chord.
   */
  function renderRanking() {
    openExample(FIXTURES.short);
    const { boxes, settings, key } = state();
    const box = { ...boxes[0], fill: { ...boxes[0].fill, mode: 'scale' as const } };
    const view = getBoxView(box, settings);
    const first = buildRankingView(box, view, undefined, key);
    if (!first) throw new Error('the fixture box should rank its scales');
    const ranking = buildRankingView(box, view, undefined, key, first.sections[0].rows[0].scale.ref);
    if (!ranking) throw new Error('the fixture box should rank its scales');
    const { container } = render(<RankingList ranking={ranking} color={box.color} onSelect={vi.fn()} />);
    return { container, ranking };
  }

  it('says what the Suggested chip marks in text, rather than in a tooltip no phone shows', () => {
    const { container, ranking } = renderRanking();
    const suggested = [...ranking.sections.flatMap((s) => s.rows), ...ranking.distant].some((row) => row.suggested);
    expect(suggested, 'the fixture should rank at least one scale as suggested').toBe(true);

    expect(screen.getAllByText(/Suggested: the scale this chord/).length).toBeGreaterThan(0);
    // A native `title` is invisible to touch and silent to a screen reader; nothing here may rely on one.
    expect(container.querySelector('[title]')).toBeNull();
  });

  it('names a suggested row as suggested, so it is not a sighted-only mark', () => {
    renderRanking();
    expect(screen.getAllByRole('button', { name: /, suggested.*:/ }).length).toBeGreaterThan(0);
  });

  // A ranking draws every candidate scale as a row of twelve cells, several hundred elements in all,
  // and axe walks each one. That takes a couple of seconds on its own and more than the default five
  // on a busy machine, which is a runtime budget and not a finding.
  it('has no axe violations', async () => {
    const { container } = renderRanking();
    expect(await axeRuleIds(container)).toEqual([]);
  }, 20_000);
});
