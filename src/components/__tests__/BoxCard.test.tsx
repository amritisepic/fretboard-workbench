// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TUNING_PRESETS } from '../../data/tunings';
import { useWorkbench } from '../../state/workbench';
import { axeRuleIds } from '../../test/axe';
import { C_MAJOR_POSITIONS, resetStores } from '../../test/fixtures';
import { MAX_CHORD_NOTES } from '../../theory';
import { getBoxView } from '../boardModel';
import { BoxCard, type AnalysisTag } from '../BoxCard';

const state = () => useWorkbench.getState();

/** A box in the store holding `positions`, so the card's own store calls find it. */
function seedBox(positions: readonly { string: number; fret: number }[] = C_MAJOR_POSITIONS) {
  const id = state().addBox();
  for (const position of positions) state().togglePosition(id, position);
  const box = state().boxes.find((b) => b.id === id);
  if (!box) throw new Error('box vanished');
  return box;
}

const TAG: AnalysisTag = {
  label: { numeral: 'I', suffix: '', figures: [], target: '', note: '', text: 'I' },
  explanation: 'C is I in C major.',
};

function renderCard(overrides: Partial<Parameters<typeof BoxCard>[0]> = {}) {
  const box = overrides.box ?? seedBox();
  const onRequestRemove = overrides.onRequestRemove ?? vi.fn();
  const { container } = render(
    <BoxCard
      box={box}
      view={getBoxView(box, state().settings)}
      numeral="I"
      keyName="C major"
      tentative={false}
      tag={null}
      selected={false}
      viewing={false}
      onRequestRemove={onRequestRemove}
      {...overrides}
    />,
  );
  return { container, box, onRequestRemove };
}

describe('BoxCard', () => {
  beforeEach(resetStores);

  it('names the chord the clicked notes make', () => {
    renderCard();
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('C');
  });

  it('prompts for notes while the box is empty, and says nothing to click in view mode', () => {
    const empty = seedBox([]);
    renderCard({ box: empty });
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Click the fretboard to add notes');
    renderCard({ box: empty, viewing: true });
    expect(screen.getAllByRole('heading', { level: 2 })[1].textContent).toBe('No notes');
  });

  it('shows the numeral with the key it is counted from', () => {
    const { container } = renderCard();
    expect(container.querySelector('.box-numeral')?.getAttribute('title')).toBe('I in C major');
  });

  it('marks a tentative numeral', () => {
    const { container } = renderCard({ tentative: true });
    const numeral = container.querySelector('.box-numeral');
    expect(numeral?.classList.contains('is-tentative')).toBe(true);
    expect(numeral?.textContent).toContain('?');
  });

  it('asks to remove the box rather than removing it, and does not select it on the way', () => {
    const { box, onRequestRemove } = renderCard();
    state().selectBox(null);
    fireEvent.click(screen.getByRole('button', { name: /^Remove/ }));
    expect(onRequestRemove).toHaveBeenCalledExactlyOnceWith(box.id);
    expect(state().boxes).toHaveLength(1);
    // The card selects the box when clicked; the remove button must not do that on the way out.
    expect(state().selectedBoxId).toBeNull();
  });

  it('hides the remove button in view mode', () => {
    renderCard({ viewing: true });
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();
  });

  it('says so when a click is refused because the chord is full', () => {
    // One note per string caps a six-string chord at six notes on its own, so the refusal is only
    // reachable on an instrument with more strings than MAX_CHORD_NOTES.
    state().applyTuning(TUNING_PRESETS[3].tuning);
    expect(state().settings.tuning.length).toBeGreaterThan(MAX_CHORD_NOTES);
    const full = seedBox([0, 1, 2, 3, 4, 5].map((string) => ({ string, fret: string + 1 })));
    expect(full.positions).toHaveLength(MAX_CHORD_NOTES);

    const { container } = renderCard({ box: full });
    const view = getBoxView(full, state().settings);
    const index = view.dots.findIndex((d) => d.string === 6 && d.fret === 7);
    // A position with nothing drawn on it is one rect and has no circle inside it to aim at.
    fireEvent.click(container.querySelectorAll('.position')[index]);
    expect(screen.getByRole('status').textContent).toContain(`${MAX_CHORD_NOTES} notes at most`);
  });

  it('has no axe violations', async () => {
    const { container } = renderCard({ tag: TAG });
    expect(await axeRuleIds(container)).toEqual([]);
  });

  // ---- Known gaps -------------------------------------------------------

  // The header prints the numeral in its own chip and again inside the function tag below it
  // ("I" above "I7"). Plan item 12 (Phase 2) collapses them into one chip.
  it.fails('does not restate the numeral in the function tag', () => {
    const { container } = renderCard({ tag: TAG });
    const numeral = container.querySelector('.box-numeral')?.textContent?.trim();
    // FunctionText prints the label twice, once visually hidden; the hidden copy is the plain text.
    const fn = container.querySelector('.function-tag .visually-hidden')?.textContent?.trim();
    expect(numeral && fn?.startsWith(numeral)).toBeFalsy();
  });

  // The header prints the numeral in its own chip and again inside the function tag below it
  // ("I" above "I7"). Plan item 12 (Phase 2) collapses them into one chip.
});

describe('the chord function explanation', () => {
  beforeEach(resetStores);

  it('stays out of the DOM until it is opened', () => {
    const { container } = renderCard({ tag: TAG });
    expect(container.querySelector('.info-explanation')).toBeNull();
    expect(screen.getByRole('button', { name: /What this means/ })).toHaveProperty('ariaExpanded', 'false');
  });

  it('opens on a tap, which is the only way in on a touch screen', () => {
    renderCard({ tag: TAG });
    fireEvent.click(screen.getByRole('button', { name: /What this means/ }));
    expect(screen.getByRole('note').textContent).toBe(TAG.explanation);
  });

  it('closes on Escape and on a press outside it', () => {
    renderCard({ tag: TAG });
    const trigger = screen.getByRole('button', { name: /What this means/ });

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('note')).toBeNull();

    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('is held open by a click, so moving the mouse away does not take it back', () => {
    renderCard({ tag: TAG });
    const trigger = screen.getByRole('button', { name: /What this means/ });

    // The usual mouse order: hover opens it, then the click lands.
    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    fireEvent.click(trigger);
    expect(screen.getByRole('note'), 'a click must not close what hovering opened').toBeDefined();

    fireEvent.pointerLeave(trigger, { pointerType: 'mouse' });
    expect(screen.getByRole('note'), 'a held popover survives the pointer leaving').toBeDefined();

    fireEvent.click(trigger);
    expect(screen.queryByRole('note'), 'clicking again lets it go').toBeNull();
  });

  it('opens on hover with a mouse, and ignores a hover that a tap produced', () => {
    renderCard({ tag: TAG });
    const trigger = screen.getByRole('button', { name: /What this means/ });

    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
    expect(screen.getByRole('note')).toBeDefined();
    fireEvent.pointerLeave(trigger, { pointerType: 'mouse' });
    expect(screen.queryByRole('note')).toBeNull();

    // A finger fires pointerenter too; letting that toggle would fight the click that follows.
    fireEvent.pointerEnter(trigger, { pointerType: 'touch' });
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('does not select the box behind it when opened', () => {
    const { box } = renderCard({ tag: TAG });
    state().selectBox(null);
    fireEvent.click(screen.getByRole('button', { name: /What this means/ }));
    expect(state().selectedBoxId).toBeNull();
    expect(box.id).toBeDefined();
  });
});
