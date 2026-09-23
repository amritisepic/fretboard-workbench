// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { css } from '../../design/styles';
import { useLibrary } from '../../state/library';
import { usePreferences } from '../../state/preferences';
import { axeRuleIds } from '../../test/axe';
import { FIXTURES, openExample, resetStores } from '../../test/fixtures';
import { TopBar } from '../TopBar';

type Props = Parameters<typeof TopBar>[0];

function renderBar(overrides: Partial<Props> = {}) {
  const props: Props = {
    settingsOpen: false,
    explorerOpen: false,
    onToggleSettings: vi.fn(),
    onToggleExplorer: vi.fn(),
    onOpenExport: vi.fn(),
    onStartTour: vi.fn(),
    ...overrides,
  };
  const view = render(<TopBar {...props} />);
  const bar = view.container.querySelector('header');
  if (!bar) throw new Error('No top bar rendered');
  return { ...view, props, bar, rerenderWith: (next: Partial<Props>) => view.rerender(<TopBar {...props} {...next} />) };
}

/** The bar's buttons that are buttons, as opposed to the options of its two Segmented choices. */
const plainButtons = (bar: HTMLElement) => [...bar.querySelectorAll<HTMLButtonElement>('button:not([role="radio"])')];

describe('TopBar', () => {
  beforeEach(() => {
    resetStores();
    openExample(FIXTURES.short);
  });

  it('keeps every hook the guided tour and the browser tests find its controls by', () => {
    const { bar } = renderBar();
    for (const name of ['app-switch', 'presets', 'view-mode', 'guide', 'export', 'settings']) {
      expect(bar.querySelectorAll(`[data-tour="${name}"]`), name).toHaveLength(1);
    }
    // What the two panels hand focus back to when they close.
    expect(bar.querySelector('[data-explorer-tab]')).toBe(screen.getByRole('button', { name: 'Presets' }));
    expect(bar.querySelector('[data-settings-tab]')).toBe(screen.getByRole('button', { name: 'Settings' }));
  });

  // Plan item 21: tabs for two of the panel buttons, pills for the other two and a solid dark Save
  // made five treatments in one bar, for controls that differ only in what they open.
  it('draws every button at one of the three levels, and the four that open things as tertiary', () => {
    const { bar } = renderBar();
    for (const button of plainButtons(bar)) {
      expect(button.classList.contains('button'), button.textContent ?? '').toBe(true);
      const levels = ['is-primary', 'is-tertiary'].filter((level) => button.classList.contains(level));
      expect(levels.length, `${button.textContent}: one level at most, secondary being the default`).toBeLessThanOrEqual(1);
    }
    for (const name of ['Presets', 'Guide', 'Export', 'Settings']) {
      expect(screen.getByRole('button', { name }).classList.contains('is-tertiary'), name).toBe(true);
    }
  });

  it('makes Save the primary button while there is something to save, and secondary once there is not', () => {
    const { rerenderWith } = renderBar();
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save.classList.contains('is-primary')).toBe(true);

    useLibrary.setState({ saveFeedback: 'saved' });
    rerenderWith({});
    const saved = screen.getByRole('button', { name: 'Saved' });
    expect(saved.classList.contains('is-primary')).toBe(false);
    expect(saved.classList.contains('is-tertiary')).toBe(false);
  });

  it('says which panel is open through aria-expanded, which is what the tabs used to draw', () => {
    const { rerenderWith } = renderBar();
    const presets = screen.getByRole('button', { name: 'Presets' });
    const settings = screen.getByRole('button', { name: 'Settings' });
    expect([presets.getAttribute('aria-expanded'), settings.getAttribute('aria-expanded')]).toEqual(['false', 'false']);

    rerenderWith({ settingsOpen: true });
    expect([presets.getAttribute('aria-expanded'), settings.getAttribute('aria-expanded')]).toEqual(['false', 'true']);
    for (const button of [presets, settings]) expect(button.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('opens what each button names', () => {
    const { props } = renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guide' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(props.onToggleExplorer).toHaveBeenCalledOnce();
    expect(props.onToggleSettings).toHaveBeenCalledOnce();
    expect(props.onStartTour).toHaveBeenCalledOnce();
    expect(props.onOpenExport).toHaveBeenCalledOnce();
  });

  // Tablets and phones show these four as icons alone. The words stay in the document, clipped rather
  // than removed, which is what keeps them the buttons' names: on phones the old tabs hid them with
  // `display: none`, and Presets and Settings had no name at all.
  it('names each icon button by its own text, not by the icon', () => {
    const { bar } = renderBar();
    for (const name of ['Presets', 'Guide', 'Export', 'Settings']) {
      const button = within(bar).getByRole('button', { name });
      expect(button.querySelector('.button-label')?.textContent).toBe(name);
      expect(button.getAttribute('aria-label')).toBeNull();
    }
  });

  it('keeps the two-way choices as Segmented radiogroups', () => {
    renderBar();
    expect(screen.getByRole('radiogroup', { name: 'Tool' }).classList.contains('segmented')).toBe(true);
    expect(screen.getByRole('radiogroup', { name: 'Mode' }).classList.contains('segmented')).toBe(true);
  });

  it('has no axe violations on the workbench', async () => {
    const { container } = renderBar({ settingsOpen: true });
    expect(await axeRuleIds(container)).toEqual([]);
  });

  it('has no axe violations on the scale wizard', async () => {
    usePreferences.getState().setScreen('scales');
    const { container, bar } = renderBar();
    expect(within(bar).queryByRole('button', { name: /^Save/ })).toBeNull();
    expect(await axeRuleIds(container)).toEqual([]);
  });
});

describe('the button vocabulary', () => {
  /** Every `.button.is-*` modifier the stylesheet styles. */
  const modifiers = [...new Set([...css.matchAll(/\.button\.(is-[a-z-]+)/g)].map((match) => match[1]))].sort();

  it('is three levels, one tone and two sizes, and nothing else', () => {
    // Secondary is `.button` alone. Primary and tertiary are the other two levels, danger is a tone
    // that rides on any of them, compact is the second size and icon squares either size off.
    expect(modifiers).toEqual(['is-compact', 'is-danger', 'is-icon', 'is-primary', 'is-tertiary']);
  });

  it('keeps both sizes over the WCAG 2.2 minimum of 24px', () => {
    const height = (selector: string) => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Top-level rules start at the beginning of a line; the ones inside a media query are indented.
      const rule = new RegExp(`^${escaped} \\{[^}]*?\\sheight:\\s*([\\d.]+)px`, 'm').exec(css);
      if (!rule) throw new Error(`No height for ${selector}`);
      return Number(rule[1]);
    };
    expect(height('.button')).toBeGreaterThanOrEqual(24);
    expect(height('.button.is-compact')).toBeGreaterThanOrEqual(24);
  });
});
