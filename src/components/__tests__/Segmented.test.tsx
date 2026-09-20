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

  it('moves the selection with the arrow keys, as a radiogroup must', () => {
    const { onChange, group } = renderSegmented('edit');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledExactlyOnceWith('view');
  });

  it('is a single tab stop, with only the checked option reachable by Tab', () => {
    const { group } = renderSegmented('edit');
    const stops = [...group.querySelectorAll('button')].filter((b) => b.tabIndex >= 0);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveProperty('ariaChecked', 'true');
  });

  it('wraps at both ends, and takes Home and End to them', () => {
    const { onChange, group } = renderSegmented('edit');
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('view');
    fireEvent.keyDown(group, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('view');
    fireEvent.keyDown(group, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('edit');
  });

  it('moves focus with the selection, so the group keeps its one tab stop', () => {
    const { group } = renderSegmented('edit');
    screen.getByRole('radio', { name: 'Edit' }).focus();
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'View' }));
  });

  it('leaves keys it does not claim to the browser and the app', () => {
    const { onChange, group } = renderSegmented('edit');
    const seen: string[] = [];
    const listen = (event: KeyboardEvent) => seen.push(`${event.ctrlKey ? 'Ctrl+' : ''}${event.key}`);
    window.addEventListener('keydown', listen);
    try {
      // The app nudges the selected box's root with the bare arrow keys, from a window listener, so
      // an arrow key the group acts on must not reach it; Ctrl+Arrow and Tab are not the group's.
      fireEvent.keyDown(group, { key: 'ArrowRight' });
      fireEvent.keyDown(group, { key: 'ArrowRight', ctrlKey: true });
      fireEvent.keyDown(group, { key: 'Tab' });
    } finally {
      window.removeEventListener('keydown', listen);
    }
    expect(seen).toEqual(['ArrowRight', 'Tab']);
    expect(onChange).toHaveBeenCalledExactlyOnceWith('view');
  });
});
