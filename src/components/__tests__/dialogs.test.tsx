// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkbench } from '../../state/workbench';
import { axeRuleIds } from '../../test/axe';
import { FIXTURES, openExample, resetStores } from '../../test/fixtures';
import { ConfirmDialog } from '../ConfirmDialog';
import { ExportDialog } from '../export/ExportDialog';
import { SettingsPanel } from '../SettingsPanel';

const confirmProps = () => ({
  title: 'Delete this box?',
  body: "Its notes and settings will be removed. This can't be undone.",
  confirmLabel: 'Delete box',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
});

describe('ConfirmDialog', () => {
  beforeEach(resetStores);

  it('names itself and describes what is about to happen', () => {
    const props = confirmProps();
    render(<ConfirmDialog {...props} />);
    const dialog = screen.getByRole('alertdialog', { name: props.title });
    expect(within(dialog).getByText(props.body)).toBeDefined();
  });

  it('starts with Cancel focused, so Enter is never destructive', () => {
    render(<ConfirmDialog {...confirmProps()} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('cancels on Escape, on the backdrop and on the Cancel button', () => {
    const props = confirmProps();
    const { container } = render(<ConfirmDialog {...props} />);
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    fireEvent.pointerDown(container.querySelector('.dialog-backdrop') as Element);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onCancel).toHaveBeenCalledTimes(3);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('confirms only from the confirm button', () => {
    const props = confirmProps();
    render(<ConfirmDialog {...props} />);
    fireEvent.click(screen.getByRole('button', { name: props.confirmLabel }));
    expect(props.onConfirm).toHaveBeenCalledOnce();
  });

  it('has no axe violations', async () => {
    const { container } = render(<ConfirmDialog {...confirmProps()} />);
    expect(await axeRuleIds(container)).toEqual([]);
  });

  // ---- Known gaps -------------------------------------------------------

  // It declares aria-modal but nothing holds focus inside it, so Tab walks straight out into the
  // page behind. Plan item 28 (Phase 4) moves the dialogs onto <dialog>.showModal().
  it.fails('keeps focus inside the dialog', () => {
    render(
      <>
        <button type="button">behind the dialog</button>
        <ConfirmDialog {...confirmProps()} />
      </>,
    );
    const outside = screen.getByRole('button', { name: 'behind the dialog' });
    expect(outside.closest('[inert]') ?? outside.inert).toBeTruthy();
  });

  // The label and description ids are string literals, so two dialogs on screen at once would both
  // claim them. Plan item 28 (Phase 4) switches to useId.
  it.fails('gives each dialog its own element ids', () => {
    render(
      <>
        <ConfirmDialog {...confirmProps()} />
        <ConfirmDialog {...confirmProps()} />
      </>,
    );
    expect(document.querySelectorAll('#dialog-title')).toHaveLength(1);
  });
});

describe('SettingsPanel', () => {
  beforeEach(resetStores);

  it('shows the tuning, the strings, the capo and the frets', () => {
    render(<SettingsPanel onClose={vi.fn()} />);
    const panel = screen.getByRole('dialog', { name: 'Settings' });
    expect(within(panel).getByLabelText('Tuning')).toBeDefined();
    expect(within(panel).getByLabelText('Frets')).toBeDefined();
    expect(within(panel).getByRole('group', { name: 'Capo' })).toBeDefined();
    expect(within(panel).getByRole('switch', { name: 'Fret markers' })).toBeDefined();
  });

  it('lists one note and one octave select per string, highest string first', () => {
    render(<SettingsPanel onClose={vi.fn()} />);
    const strings = useWorkbench.getState().settings.tuning.length;
    expect(screen.getAllByLabelText(/^String \d+ note$/)).toHaveLength(strings);
    expect(screen.getAllByLabelText(/^String \d+ octave$/)).toHaveLength(strings);
    // Listed top down, matching the board: the 1st string (the highest) comes first.
    expect(screen.getAllByLabelText(/^String \d+ note$/)[0].getAttribute('aria-label')).toBe('String 1 note');
  });

  it('clamps a fret count outside the allowed range and says what it did', () => {
    render(<SettingsPanel onClose={vi.fn()} />);
    const input = screen.getByLabelText('Frets');
    fireEvent.change(input, { target: { value: '99' } });
    fireEvent.blur(input);
    expect(useWorkbench.getState().settings.fretCount).toBe(30);
    // The capo and string steppers use <output>, which is also role="status", so ask by id.
    expect(document.getElementById('fret-count-message')?.textContent).toContain('set to 30');
  });

  it('closes on a pointer press outside itself', () => {
    const onClose = vi.fn();
    render(<SettingsPanel onClose={onClose} />);
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('has no axe violations', async () => {
    const { container } = render(<SettingsPanel onClose={vi.fn()} />);
    expect(await axeRuleIds(container)).toEqual([]);
  });

  // ---- Known gaps -------------------------------------------------------

  // It is a role="dialog" with no aria-modal, no focus trap and no focus restore: a screen reader
  // keeps reading the canvas behind it. Plan item 28 (Phase 4).
  it.fails('declares itself modal', () => {
    render(<SettingsPanel onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Settings' }).getAttribute('aria-modal')).toBe('true');
  });
});

describe('ExportDialog', () => {
  beforeEach(resetStores);

  it('offers the format, the chords and what to show', () => {
    openExample(FIXTURES.short);
    render(<ExportDialog screen="workbench" onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Export preset' });
    expect(within(dialog).getByRole('radiogroup', { name: 'Format' })).toBeDefined();
    expect(within(dialog).getByLabelText('Paper size')).toBeDefined();
    expect(within(dialog).getByRole('checkbox', { name: 'Harmonic analysis' })).toBeDefined();
  });

  it('lists every chord, all of them chosen to start with', () => {
    const count = openExample(FIXTURES.short);
    const { container } = render(<ExportDialog screen="workbench" onClose={vi.fn()} />);
    const boxes = [...container.querySelectorAll<HTMLInputElement>('.export-boxes input[type="checkbox"]')];
    expect(boxes).toHaveLength(count);
    expect(boxes.every((b) => b.checked)).toBe(true);
  });

  it('closes from the close button and from Escape', () => {
    openExample(FIXTURES.short);
    const onClose = vi.fn();
    render(<ExportDialog screen="workbench" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close export' }));
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Export preset' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  // ---- Known gaps -------------------------------------------------------

  // "Chords (4 of 4)" and "Show" are loose <span class="field-label"> next to their checkboxes, so a
  // screen reader hears a dozen ungrouped checkboxes with no idea what they belong to. Plan item 32
  // (Phase 5) rebuilds the dialog; the groups want a fieldset or role="group" either way.
  it.fails('groups the export checkboxes under the heading that names them', () => {
    openExample(FIXTURES.short);
    render(<ExportDialog screen="workbench" onClose={vi.fn()} />);
    expect(screen.getByRole('group', { name: /^Chords/ })).toBeDefined();
    expect(screen.getByRole('group', { name: 'Show' })).toBeDefined();
  });

  // Counted so the number is visible and has to be argued down rather than drifting up. Plan items
  // 32 and 33 (Phase 5) put everything past format and download behind "More options".
  it.fails('asks for no more than six decisions before a file can be downloaded', () => {
    openExample(FIXTURES.short);
    const { container } = render(<ExportDialog screen="workbench" onClose={vi.fn()} />);
    const options = container.querySelector('.export-options') as Element;
    const controls = options.querySelectorAll('[role="radiogroup"], select, input[type="range"], .export-show input');
    expect(controls.length).toBeLessThanOrEqual(6);
  });
});
