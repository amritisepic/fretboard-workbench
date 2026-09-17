// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axeRuleIds } from '../../test/axe';
import { Segmented, type SegmentedOption } from '../Segmented';

type Mode = 'edit' | 'view';

const OPTIONS: readonly SegmentedOption<Mode>[] = [
  { value: 'edit', label: 'Edit' },
  { value: 'view', label: 'View' },
];

const renderSegmented = (value: Mode = 'edit', onChange = vi.fn()) => {
  render(<Segmented label="Mode" options={OPTIONS} value={value} onChange={onChange} />);
  return { onChange, group: screen.getByRole('radiogroup', { name: 'Mode' }) };
};

describe('Segmented', () => {
  it('renders one radio per option and marks the current value', () => {
    renderSegmented('view');
    expect(screen.getAllByRole('radio').map((b) => b.textContent)).toEqual(['Edit', 'View']);
    expect(screen.getByRole('radio', { name: 'View' })).toHaveProperty('ariaChecked', 'true');
    expect(screen.getByRole('radio', { name: 'Edit' })).toHaveProperty('ariaChecked', 'false');
  });

  it('reports the option that was clicked', () => {
    const { onChange } = renderSegmented('edit');
    fireEvent.click(screen.getByRole('radio', { name: 'View' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('view');
  });

  it('has no axe violations', async () => {
    const { group } = renderSegmented();
    expect(await axeRuleIds(group)).toEqual([]);
  });

  // ---- Known gaps -------------------------------------------------------
  // These describe the behaviour a radiogroup promises but this component does not implement, so
  // they are expected to fail today. Plan item 27 (Phase 4) fixes them; when it does, these tests
  // start passing, `it.fails` reports that, and the `.fails` comes off.

  it.fails('moves the selection with the arrow keys, as a radiogroup must', () => {
    const { onChange, group } = renderSegmented('edit');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledExactlyOnceWith('view');
  });

  it.fails('is a single tab stop, with only the checked option reachable by Tab', () => {
    const { group } = renderSegmented('edit');
    const stops = [...group.querySelectorAll('button')].filter((b) => b.tabIndex >= 0);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveProperty('ariaChecked', 'true');
  });
});
