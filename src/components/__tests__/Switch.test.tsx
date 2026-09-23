// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import css from '../../styles.css?inline';
import { axeRuleIds } from '../../test/axe';
import { Switch } from '../Switch';

const renderSwitch = (checked = false, extra: Partial<Parameters<typeof Switch>[0]> = {}) => {
  const onChange = vi.fn();
  const { container } = render(<Switch label="Fret markers" checked={checked} onChange={onChange} {...extra} />);
  return { container, onChange, control: screen.getByRole('switch', { name: 'Fret markers' }) };
};

/**
 * The declarations of the top-level rule whose selector is exactly `selector`. Top-level rules start at
 * the beginning of a line; the ones inside a media query are indented.
 */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^${escaped} \\{([^}]*)\\}`, 'm').exec(css);
  if (!match) throw new Error(`No rule for ${selector} in styles.css`);
  return match[1];
}

const px = (declarations: string, property: string): number => {
  const match = new RegExp(`(?:^|;|\\s)${property}:\\s*([\\d.]+)px`).exec(declarations);
  if (!match) throw new Error(`No ${property} in px`);
  return Number(match[1]);
};

describe('Switch', () => {
  it('is a button with the switch role, whose state is aria-checked', () => {
    const { control } = renderSwitch(true);
    // A native button is what gives Space and Enter for free, so the role is the only ARIA it needs
    // beyond its state.
    expect(control.tagName).toBe('BUTTON');
    expect(control.getAttribute('type')).toBe('button');
    expect(control.getAttribute('aria-checked')).toBe('true');
  });

  it('reports the opposite of its state when pressed, and leaves the state to its owner', () => {
    const { control, onChange } = renderSwitch(false);
    fireEvent.click(control);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
    // Controlled: the owner has not re-rendered it, so it still says what the owner last said.
    expect(control.getAttribute('aria-checked')).toBe('false');
  });

  it('can be pressed by its name as well as by its track', () => {
    const { onChange } = renderSwitch(true);
    fireEvent.click(screen.getByText('Fret markers'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('names the key that does the same thing, when there is one', () => {
    const { control } = renderSwitch(false, { keyShortcuts: 'Space' });
    expect(control.getAttribute('aria-keyshortcuts')).toBe('Space');
  });

  it('puts what it is given between the name and the track', () => {
    const { container } = renderSwitch(false, { children: <kbd>Space</kbd> });
    const parts = [...(container.querySelector('.switch')?.children ?? [])].map((el) => el.tagName);
    expect(parts).toEqual(['LABEL', 'KBD', 'BUTTON']);
  });

  it('takes the look of a heading when its name is one', () => {
    renderSwitch(false, { labelClassName: 'field-label' });
    expect(screen.getByText('Fret markers').className).toBe('field-label');
  });

  it('gives each instance ids of its own', () => {
    render(
      <>
        <Switch label="Common tones" checked onChange={vi.fn()} />
        <Switch label="Voice leading" checked={false} onChange={vi.fn()} />
      </>,
    );
    expect(screen.getByRole('switch', { name: 'Common tones' }).id).not.toBe(
      screen.getByRole('switch', { name: 'Voice leading' }).id,
    );
  });

  it('has no axe violations, on or off', async () => {
    const on = renderSwitch(true);
    expect(await axeRuleIds(on.container)).toEqual([]);
    const off = render(<Switch label="Voice leading" checked={false} onChange={vi.fn()} />);
    expect(await axeRuleIds(off.container)).toEqual([]);
  });

  // jsdom does no layout, so the size is read from the stylesheet. The four hand-written switches it
  // replaced were 22px tall, under the minimum, and counted in the browser suite's targetsUnder24.
  it('is at least 24px on its smaller side, the WCAG 2.2 minimum for a target', () => {
    const track = rule('.switch-track');
    expect(Math.min(px(track, 'width'), px(track, 'height'))).toBeGreaterThanOrEqual(24);
  });
});
