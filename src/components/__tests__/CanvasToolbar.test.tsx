// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useWorkbench, type StripSettings } from '../../state/workbench';
import { axeRuleIds } from '../../test/axe';
import { FIXTURES, openExample, resetStores } from '../../test/fixtures';
import { CanvasToolbar } from '../CanvasToolbar';

const state = () => useWorkbench.getState();

/**
 * The toolbar over a real progression, so Find key has chords to work on. The built-in examples open
 * with harmonic analysis on, so a test that switches it names the state it starts from rather than
 * inheriting the example's.
 */
function renderToolbar(strips: Partial<StripSettings> = {}) {
  openExample(FIXTURES.short);
  state().setStrips(strips);
  const { container } = render(<CanvasToolbar />);
  return { container, trigger: screen.getByRole('button', { name: 'Display' }) };
}

function openDisplay(trigger: HTMLElement) {
  fireEvent.click(trigger);
  return screen.getByRole('dialog', { name: 'Display' });
}

/**
 * Everything a user can operate that sits in the bar itself, outside the popover: the controls whose
 * position matters, because moving one moves what is under the user's finger.
 */
function barControls(container: HTMLElement): string[] {
  const bar = container.querySelector('.canvas-toolbar');
  if (!bar) throw new Error('No toolbar rendered');
  return [...bar.querySelectorAll<HTMLElement>('button, select, [role="radio"], [role="switch"]')]
    .filter((el) => el.closest('[role="dialog"]') === null)
    .map((el) => el.getAttribute('aria-label') ?? el.textContent ?? el.tagName);
}

describe('CanvasToolbar', () => {
  beforeEach(resetStores);

  it('keeps what changes the music in the bar, and puts what changes the drawing behind Display', () => {
    const { container } = renderToolbar();
    expect(barControls(container)).toEqual([
      'Key root',
      'Key',
      'Find key',
      'Shift every chord, scale and the key down a semitone',
      'Shift every chord, scale and the key up a semitone',
      'Display',
    ]);
    // Not merely hidden: a closed popover is not in the DOM, so none of these can be tabbed to.
    for (const name of ['Neck orientation', 'Board view', 'Labels between boxes', 'Analysis notation']) {
      expect(screen.queryByRole('radiogroup', { name })).toBeNull();
    }
    for (const name of ['Common tones', 'Voice leading', 'Harmonic analysis']) {
      expect(screen.queryByRole('switch', { name })).toBeNull();
    }
  });

  it('keeps view mode showing what it showed before, less the key and the shift', () => {
    openExample(FIXTURES.short);
    state().setViewing(true);
    const { container } = render(<CanvasToolbar />);
    // View mode hid Key and Shift before this change and still does; the display controls it kept
    // are all still reachable, now through the one button.
    expect(barControls(container)).toEqual(['Display']);
    const dialog = openDisplay(screen.getByRole('button', { name: 'Display' }));
    expect(within(dialog).getByRole('radiogroup', { name: 'Neck orientation' })).toBeDefined();
    expect(within(dialog).getByRole('radiogroup', { name: 'Board view' })).toBeDefined();
    expect(within(dialog).getByRole('switch', { name: 'Common tones' })).toBeDefined();
    expect(within(dialog).getByRole('switch', { name: 'Voice leading' })).toBeDefined();
    expect(within(dialog).getByRole('switch', { name: 'Harmonic analysis' })).toBeDefined();
  });

  describe('the Display popover', () => {
    it('is a real button that says whether it is open and what it opens', () => {
      const { trigger } = renderToolbar();
      // A native button is what gives Enter and Space for free. jsdom does not turn a key press on a
      // button into a click, so asserting the keys here would test jsdom; the element is what counts.
      expect(trigger.tagName).toBe('BUTTON');
      expect(trigger.getAttribute('type')).toBe('button');
      expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(trigger.hasAttribute('aria-controls')).toBe(false);

      const dialog = openDisplay(trigger);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(trigger.getAttribute('aria-controls')).toBe(dialog.id);
    });

    it('takes focus when it opens, so its name is read out', () => {
      const { trigger } = renderToolbar();
      const dialog = openDisplay(trigger);
      expect(document.activeElement).toBe(dialog);
    });

    it('closes on Escape and gives focus back to the Display button', () => {
      const { trigger } = renderToolbar();
      const dialog = openDisplay(trigger);
      // From a control inside, as a keyboard user would be, not only from the panel itself.
      const radio = within(dialog).getByRole('radio', { name: 'Horizontal' });
      radio.focus();
      fireEvent.keyDown(radio, { key: 'Escape' });
      expect(screen.queryByRole('dialog', { name: 'Display' })).toBeNull();
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(trigger);
    });

    it('closes when the button is pressed again', () => {
      const { trigger } = renderToolbar();
      openDisplay(trigger);
      // The press-outside listener must not see the button as outside, or the pointerdown would
      // close the panel and the click would open it straight back up.
      fireEvent.pointerDown(trigger);
      fireEvent.click(trigger);
      expect(screen.queryByRole('dialog', { name: 'Display' })).toBeNull();
    });

    it('closes on a press anywhere else, and leaves focus where that press put it', () => {
      const { trigger } = renderToolbar();
      openDisplay(trigger);
      fireEvent.pointerDown(document.body);
      expect(screen.queryByRole('dialog', { name: 'Display' })).toBeNull();
      expect(document.activeElement).not.toBe(trigger);
    });

    it('does not strand focus: Tab leaves the panel the ordinary way, with no trap', () => {
      const { trigger } = renderToolbar();
      const dialog = openDisplay(trigger);
      const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      dialog.dispatchEvent(tab);
      // A non-modal popover leaves Tab to the browser. Cancelling it would hold focus inside.
      expect(tab.defaultPrevented).toBe(false);
      expect(dialog.getAttribute('aria-modal')).toBeNull();
    });

    it('still drives the store from every control inside it', () => {
      const { trigger } = renderToolbar({ commonTones: true, voiceLeading: true, analysis: false });
      const dialog = openDisplay(trigger);

      fireEvent.click(within(dialog).getByRole('radio', { name: 'Horizontal' }));
      expect(state().orientation).toBe('horizontal');

      fireEvent.click(within(dialog).getByRole('radio', { name: 'Full neck' }));
      expect(state().settings.boardView).toBe('full');

      // Voice leading off first, so common tones alone keeps the label choice on screen for below.
      fireEvent.click(within(dialog).getByRole('switch', { name: 'Voice leading' }));
      expect(state().strips.voiceLeading).toBe(false);

      fireEvent.click(within(dialog).getByRole('radio', { name: 'Degrees' }));
      expect(state().strips.labelMode).toBe('degrees');

      fireEvent.click(within(dialog).getByRole('switch', { name: 'Common tones' }));
      expect(state().strips.commonTones).toBe(false);

      fireEvent.click(within(dialog).getByRole('switch', { name: 'Harmonic analysis' }));
      expect(state().strips.analysis).toBe(true);

      fireEvent.click(within(dialog).getByRole('radio', { name: 'Classical' }));
      expect(state().strips.notation).toBe('classical');

      // Every one of those left the panel open: changing a display setting is not a reason to close.
      expect(screen.getByRole('dialog', { name: 'Display' })).toBe(dialog);
    });

    it('shows the label and notation choices only when there is something for them to change', () => {
      const { trigger } = renderToolbar({ commonTones: false, voiceLeading: false, analysis: false });
      const dialog = openDisplay(trigger);
      expect(within(dialog).queryByRole('radiogroup', { name: 'Labels between boxes' })).toBeNull();
      expect(within(dialog).queryByRole('radiogroup', { name: 'Analysis notation' })).toBeNull();

      fireEvent.click(within(dialog).getByRole('switch', { name: 'Voice leading' }));
      expect(within(dialog).getByRole('radiogroup', { name: 'Labels between boxes' })).toBeDefined();

      fireEvent.click(within(dialog).getByRole('switch', { name: 'Harmonic analysis' }));
      expect(within(dialog).getByRole('radiogroup', { name: 'Analysis notation' })).toBeDefined();
    });
  });

  describe('switching harmonic analysis (plan item 15)', () => {
    it('leaves every control in the bar where it was when the notation choice appears', () => {
      const { container, trigger } = renderToolbar({ analysis: false });
      const before = barControls(container);
      const dialog = openDisplay(trigger);

      fireEvent.click(within(dialog).getByRole('switch', { name: 'Harmonic analysis' }));
      const notation = within(dialog).getByRole('radiogroup', { name: 'Analysis notation' });

      // It used to be injected into the bar between its neighbours, shoving them sideways.
      expect(barControls(container)).toEqual(before);
      expect(notation.closest('[role="dialog"]')).toBe(dialog);
    });

    it('adds the notation choice at the foot of the panel, where nothing below it can move', () => {
      const { trigger } = renderToolbar({ commonTones: true, analysis: false });
      const dialog = openDisplay(trigger);
      fireEvent.click(within(dialog).getByRole('switch', { name: 'Harmonic analysis' }));

      const controls = within(dialog).getAllByRole('radio');
      const notation = within(dialog).getByRole('radiogroup', { name: 'Analysis notation' });
      const last = controls[controls.length - 1];
      expect(notation.contains(last)).toBe(true);
    });
  });

  describe('accessibility', () => {
    it('has no axe violations with the popover closed', async () => {
      const { container } = renderToolbar();
      expect(await axeRuleIds(container)).toEqual([]);
    });

    it('has no axe violations with the popover open and every dependent control showing', async () => {
      const { container, trigger } = renderToolbar({ commonTones: true, analysis: true });
      openDisplay(trigger);
      expect(await axeRuleIds(container)).toEqual([]);
    });

    it('has no axe violations in view mode', async () => {
      openExample(FIXTURES.short);
      state().setViewing(true);
      const { container } = render(<CanvasToolbar />);
      expect(await axeRuleIds(container)).toEqual([]);
    });
  });
});
