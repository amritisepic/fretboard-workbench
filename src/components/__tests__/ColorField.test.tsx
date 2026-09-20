// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useWorkbench } from '../../state/workbench';
import { axeRuleIds } from '../../test/axe';
import { resetStores } from '../../test/fixtures';
import { ColorField, SWATCHES } from '../ColorField';

const state = () => useWorkbench.getState();

const RED = SWATCHES[0];
const ORANGE = SWATCHES[1];
const TEAL = SWATCHES[4];
const LAST = SWATCHES[SWATCHES.length - 1];

/**
 * The field writes its color through the store rather than back up a prop, so the box has to be
 * read from the store on every render; handed a plain box, the swatches would keep showing the
 * color it had when the test started.
 */
function Field({ id }: { readonly id: string }) {
  const box = useWorkbench((s) => s.boxes.find((b) => b.id === id));
  return box ? <ColorField box={box} /> : null;
}

function renderField(color: string = RED.value) {
  const id = state().addBox();
  state().setColor(id, color);
  const { container } = render(<Field id={id} />);
  return { id, container, group: screen.getByRole('radiogroup', { name: 'Dot color' }) };
}

const colorOf = (id: string) => state().boxes.find((b) => b.id === id)?.color;

/** The options Tab can land on: the pattern allows the group exactly one. */
const tabStops = (group: HTMLElement) => [...group.querySelectorAll('button')].filter((b) => b.tabIndex >= 0);

describe('ColorField', () => {
  beforeEach(resetStores);

  it('renders one radio per color and marks the one in use', () => {
    renderField(TEAL.value);
    expect(screen.getAllByRole('radio').map((b) => b.getAttribute('aria-label'))).toEqual(
      SWATCHES.map((swatch) => swatch.name),
    );
    expect(screen.getByRole('radio', { name: TEAL.name })).toHaveProperty('ariaChecked', 'true');
    expect(screen.getByRole('radio', { name: RED.name })).toHaveProperty('ariaChecked', 'false');
  });

  it('recolors the box when a swatch is clicked', () => {
    const { id } = renderField();
    fireEvent.click(screen.getByRole('radio', { name: TEAL.name }));
    expect(colorOf(id)).toBe(TEAL.value);
  });

  it('moves the selection and focus together with the arrow keys, as a radiogroup must', () => {
    const { id, group } = renderField();
    screen.getByRole('radio', { name: RED.name }).focus();
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(colorOf(id)).toBe(ORANGE.value);
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: ORANGE.name }));
  });

  it('wraps at the ends, so the swatches are one loop however the grid happens to break', () => {
    const { id, group } = renderField();
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(colorOf(id)).toBe(LAST.value);
    fireEvent.keyDown(group, { key: 'Home' });
    expect(colorOf(id)).toBe(RED.value);
    fireEvent.keyDown(group, { key: 'End' });
    expect(colorOf(id)).toBe(LAST.value);
  });

  it('is a single tab stop, with only the checked swatch reachable by Tab', () => {
    const { group } = renderField(TEAL.value);
    const stops = tabStops(group);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveProperty('ariaChecked', 'true');
  });

  it('puts the tab stop on the first swatch while a custom color leaves none of them checked', () => {
    const { group } = renderField('#123456');
    expect(screen.queryAllByRole('radio', { checked: true })).toEqual([]);
    const stops = tabStops(group);
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveProperty('ariaLabel', RED.name);
  });

  it('keeps the custom-color picker out of the radiogroup, with a tab stop of its own', () => {
    const { group } = renderField();
    const picker = screen.getByLabelText('Custom color');
    expect(group.contains(picker)).toBe(false);
    expect(picker.tabIndex).toBe(0);
  });

  it('shows the custom color on the picker once it is in use', () => {
    const { id, container } = renderField();
    fireEvent.change(screen.getByLabelText('Custom color'), { target: { value: '#123456' } });
    expect(colorOf(id)).toBe('#123456'.toUpperCase());
    expect(container.querySelector('.swatch-custom')?.classList.contains('is-active')).toBe(true);
  });

  it('has no axe violations', async () => {
    const { container } = renderField();
    expect(await axeRuleIds(container)).toEqual([]);
  });
});
