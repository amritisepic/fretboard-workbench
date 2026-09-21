// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLibrary } from '../../state/library';
import { useWorkbench } from '../../state/workbench';
import { axeRuleIds } from '../../test/axe';
import { FIXTURES, openExample, resetStores } from '../../test/fixtures';
import { ConfirmDialog } from '../ConfirmDialog';
import { ExplorerPanel } from '../ExplorerPanel';
import { ExportDialog } from '../export/ExportDialog';
import { useModalLayer } from '../focusLayer';
import { SettingsPanel } from '../SettingsPanel';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';

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

  it('keeps focus inside the dialog', () => {
    render(
      <>
        <button type="button">behind the dialog</button>
        <ConfirmDialog {...confirmProps()} />
      </>,
    );
    const outside = screen.getByRole('button', { name: 'behind the dialog' });
    expect(outside.closest('[inert]') ?? outside.inert).toBeTruthy();
  });

  it('wraps Tab round both ends of the dialog', () => {
    const props = confirmProps();
    render(<ConfirmDialog {...props} />);
    const dialog = screen.getByRole('alertdialog');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: props.confirmLabel });

    // Forwards off the last stop comes back round to the first.
    confirm.focus();
    expect(fireEvent.keyDown(dialog, { key: 'Tab' })).toBe(false);
    expect(document.activeElement).toBe(cancel);

    // And backwards off the first goes to the last.
    expect(fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })).toBe(false);
    expect(document.activeElement).toBe(confirm);

    // A press with somewhere to go inside the dialog is the browser's, so the trap leaves it alone.
    cancel.focus();
    expect(fireEvent.keyDown(dialog, { key: 'Tab' })).toBe(true);
    expect(document.activeElement).toBe(cancel);
  });

  it('hands focus back to the control that opened it', () => {
    const props = confirmProps();
    const Harness = ({ open }: { readonly open: boolean }) => (
      <>
        <button type="button">Remove box</button>
        {open && <ConfirmDialog {...props} />}
      </>
    );
    const { rerender } = render(<Harness open={false} />);
    const opener = screen.getByRole('button', { name: 'Remove box' });
    opener.focus();

    rerender(<Harness open />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));

    rerender(<Harness open={false} />);
    expect(opener.closest('[inert]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('lets Escape close it without closing the layer behind it', () => {
    // The preset panel raises its own confirmations, which the app knows nothing about: its window
    // shortcuts see an open explorer and no open dialog, so an Escape that reached them would take
    // the panel with it.
    const noop = () => {};
    function Layers() {
      const [panelOpen, setPanelOpen] = useState(true);
      const [confirmOpen, setConfirmOpen] = useState(true);
      useKeyboardShortcuts({
        screen: 'workbench',
        settingsOpen: false,
        explorerOpen: panelOpen,
        dialogOpen: false,
        closeSettings: noop,
        closeExplorer: () => setPanelOpen(false),
        closeDialog: noop,
        requestDelete: noop,
      });
      if (!panelOpen) return null;
      return (
        <div data-testid="panel">
          {confirmOpen && <ConfirmDialog {...confirmProps()} onCancel={() => setConfirmOpen(false)} />}
        </div>
      );
    }
    render(<Layers />);

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByTestId('panel')).toBeDefined();

    // And with the confirmation gone the same press does reach them, so the first half wasn't vacuous.
    fireEvent.keyDown(screen.getByTestId('panel'), { key: 'Escape' });
    expect(screen.queryByTestId('panel')).toBeNull();
  });

  // ---- Revised ----------------------------------------------------------

  // Was a known gap asserting `document.querySelectorAll('#dialog-title')` had one match. The gap
  // was real — the ids were string literals — but the assertion could not describe the fix: with
  // useId nothing is called `dialog-title` at all, so it would have gone on failing at zero. What
  // the ids owe is stated directly instead.
  it('gives each dialog its own element ids', () => {
    render(
      <>
        <ConfirmDialog {...confirmProps()} />
        <ConfirmDialog {...confirmProps()} />
      </>,
    );
    const ids = screen
      .getAllByRole('alertdialog')
      .flatMap((dialog) => [dialog.getAttribute('aria-labelledby'), dialog.getAttribute('aria-describedby')]);
    expect(ids).toHaveLength(4);
    // Four ids, all different, each naming exactly one element.
    expect(new Set(ids).size).toBe(4);
    for (const id of ids) expect(document.querySelectorAll(`[id="${id}"]`)).toHaveLength(1);
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

  // ---- Revised ----------------------------------------------------------

  // Was a known gap called 'declares itself modal', asserting aria-modal="true". The gap was real —
  // no focus management at all — but the contract was the wrong one. This panel is not modal: it
  // hangs off a top-bar tab with the canvas behind it live and clickable, and it closes on a press
  // outside, which no modal ever would. A non-modal role="dialog" is legitimate, so what it owes is
  // focus, not aria-modal, and that is what these two assert instead.
  it('is a popover rather than a modal dialog, and does not claim otherwise', () => {
    render(
      <>
        <button type="button" data-settings-tab>
          Settings
        </button>
        <SettingsPanel onClose={vi.fn()} />
      </>,
    );
    const panel = screen.getByRole('dialog', { name: 'Settings' });
    expect(panel.getAttribute('aria-modal')).toBeNull();
    // The canvas behind stays reachable, which is the thing aria-modal would have denied.
    expect(screen.getByRole('button', { name: 'Settings' }).closest('[inert]')).toBeNull();
    // Focus still moves in, so the panel's name is read out and Tab carries on from inside it.
    expect(document.activeElement).toBe(panel);
  });

  it('closes on Escape and gives focus back to the tab it hangs off', () => {
    const onClose = vi.fn();
    const Harness = ({ open }: { readonly open: boolean }) => (
      <>
        <button type="button" data-settings-tab>
          Settings
        </button>
        {open && <SettingsPanel onClose={onClose} />}
      </>
    );
    const { rerender } = render(<Harness open />);

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Settings' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();

    rerender(<Harness open={false} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Settings' }));
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

  it('opens with focus on itself and the page behind it inert', () => {
    openExample(FIXTURES.short);
    render(
      <>
        <button type="button">behind the dialog</button>
        <ExportDialog screen="workbench" onClose={vi.fn()} />
      </>,
    );
    // The dialog itself rather than its first control, so its name is read before its many options.
    expect(document.activeElement).toBe(screen.getByRole('dialog', { name: 'Export preset' }));
    expect(screen.getByRole('button', { name: 'behind the dialog' }).closest('[inert]')).not.toBeNull();
  });

  it('groups the export checkboxes under the heading that names them', () => {
    openExample(FIXTURES.short);
    render(<ExportDialog screen="workbench" onClose={vi.fn()} />);
    expect(screen.getByRole('group', { name: /^Chords/ })).toBeDefined();
    expect(screen.getByRole('group', { name: 'Show' })).toBeDefined();
  });

  // ---- Known gaps -------------------------------------------------------

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

describe('The modal focus trap', () => {
  beforeEach(resetStores);

  it('holds a press that has nowhere to go, rather than letting it out', () => {
    // None of the app's layers is ever empty, but a trap that only works when there is something to
    // move to is not a trap: with nothing inside it, Tab would walk out into the inert page behind.
    function Empty() {
      const { ref, onKeyDown } = useModalLayer<HTMLDivElement>({ onClose: vi.fn() });
      return <div role="dialog" aria-label="Empty" tabIndex={-1} ref={ref} onKeyDown={onKeyDown} />;
    }
    render(<Empty />);
    const dialog = screen.getByRole('dialog', { name: 'Empty' });

    expect(document.activeElement).toBe(dialog);
    expect(fireEvent.keyDown(dialog, { key: 'Tab' })).toBe(false);
    expect(fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })).toBe(false);
    expect(document.activeElement).toBe(dialog);
  });
});

describe('ExplorerPanel menus', () => {
  beforeEach(resetStores);

  /** Two top-level folders, so a row has a menu and the move menu has somewhere to offer. */
  const renderExplorer = () => {
    const stamp = { createdAt: 0, updatedAt: 0 };
    useLibrary.setState({
      status: 'ready',
      folders: [
        { id: 'f1', parentId: null, name: 'Ideas', ...stamp },
        { id: 'f2', parentId: null, name: 'Standards', ...stamp },
      ],
      presets: [],
    });
    const onClose = vi.fn();
    const { container } = render(
      <>
        <button type="button" data-explorer-tab>
          Presets
        </button>
        <ExplorerPanel onClose={onClose} />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Ideas' }));
    return { container, onClose, trigger: screen.getByRole('button', { name: 'Actions for Ideas' }) };
  };

  it('opens a row menu with focus on its first item', () => {
    renderExplorer();
    const items = within(screen.getByRole('menu', { name: 'Actions for Ideas' })).getAllByRole('menuitem');
    expect(document.activeElement).toBe(items[0]);
  });

  it('moves between the items with the arrow keys, wrapping at both ends', () => {
    renderExplorer();
    const menu = screen.getByRole('menu', { name: 'Actions for Ideas' });
    const items = within(menu).getAllByRole('menuitem');
    const last = items.length - 1;
    expect(last).toBeGreaterThan(1);

    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[0]);

    // Both ends wrap, as the ARIA practices describe.
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[last]);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0]);

    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(items[last]);
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('leaves keys it does not claim to the browser and the app', () => {
    renderExplorer();
    const menu = screen.getByRole('menu', { name: 'Actions for Ideas' });
    const seen: string[] = [];
    const listen = (event: KeyboardEvent) => seen.push(`${event.ctrlKey ? 'Ctrl+' : ''}${event.key}`);
    window.addEventListener('keydown', listen);
    try {
      // The app nudges the selected box's root with the bare arrow keys, from a window listener, and
      // it bails out for text entry rather than for buttons, so an arrow key the menu acts on must
      // not reach it. Ctrl+Arrow and a plain letter are not the menu's.
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      fireEvent.keyDown(menu, { key: 'ArrowDown', ctrlKey: true });
      fireEvent.keyDown(menu, { key: 'r' });
    } finally {
      window.removeEventListener('keydown', listen);
    }
    // The bare ArrowDown is missing because the menu stopped it; the other two went past.
    expect(seen).toEqual(['Ctrl+ArrowDown', 'r']);
  });

  it('closes the menu on Escape, one layer at a time, with focus back on its button', () => {
    const { onClose, trigger } = renderExplorer();

    fireEvent.keyDown(screen.getByRole('menu', { name: 'Actions for Ideas' }), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);

    // Only once the menu has gone does the next press reach the panel itself.
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Presets' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('names the move menu without owning the heading that names it', () => {
    renderExplorer();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to…' }));
    const menu = screen.getByRole('menu', { name: 'Move to' });
    const items = within(menu).getAllByRole('menuitem');
    // role="menu" owns menuitems and nothing else, so the heading sits outside the element carrying
    // the role and names it from there.
    expect(menu.querySelector('.explorer-menu-title')).toBeNull();
    expect([...menu.children]).toEqual(items);
    // The folder already lives at the top level, so that option is disabled and focus skips past it.
    expect(items.some((item) => item.hasAttribute('disabled'))).toBe(true);
    expect(document.activeElement).toBe(items.find((item) => !item.hasAttribute('disabled')));
  });

  it('hands focus back down the chain from a confirmation the menu raised', () => {
    const { trigger } = renderExplorer();
    // The menu closes as the confirmation opens, so the confirmation's idea of what opened it is the
    // menu's button rather than the item that has just been unmounted.
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = screen.getByRole('alertdialog', { name: /^Delete folder/ });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }));

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('has no axe violations with either menu open', async () => {
    const { container } = renderExplorer();
    expect(await axeRuleIds(container)).toEqual([]);
    // Both menus, since they are built differently. Note that axe does not object to a heading among
    // a menu's children, so the owned-element rule is the test above this one rather than this one.
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to…' }));
    expect(await axeRuleIds(container)).toEqual([]);
  });
});
