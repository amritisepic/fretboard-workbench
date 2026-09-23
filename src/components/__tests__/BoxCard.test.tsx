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

  it('still gives the numeral when there is no analysis to give', () => {
    const { container } = renderCard({ tag: null });
    const chips = container.querySelectorAll('.function-tag');
    expect(chips).toHaveLength(1);
    // Nothing to disclose, so nothing claims to be a control.
    expect(chips[0].tagName).toBe('SPAN');
    expect(chips[0].textContent).toContain('I');
  });

  it('says which key the numeral is counted from, where a touch screen can reach it', () => {
    const { container } = renderCard({ tag: null });
    const chip = container.querySelector('.function-tag');
    // A native tooltip needs a pointer to hover and a finger cannot hover, so `title` may repeat the
    // fact but must not be the only place it lives.
    expect(chip?.querySelector('.visually-hidden')?.textContent).toBe('I in C major');
    expect(chip?.getAttribute('title')).toBe('I in C major');
  });

  it('marks a tentative reading on the one chip, and says so in words as well as a mark', () => {
    const { container } = renderCard({ tentative: true, tag: null });
    const chips = container.querySelectorAll('.function-tag');
    expect(chips).toHaveLength(1);
    expect(chips[0].classList.contains('is-tentative')).toBe(true);
    expect(chips[0].textContent).toContain('?');
    expect(chips[0].querySelector('.visually-hidden')?.textContent).toBe(
      'I in C major, tentative: other readings are nearly as likely',
    );
  });

  it('puts the key and the doubt in the accessible name and the explanation when the chip opens', () => {
    renderCard({ tag: TAG, tentative: true });
    const trigger = screen.getByRole('button', { name: /What this means/ });
    expect(trigger.getAttribute('aria-label')).toBe('Chord function, I in C major, tentative. What this means');
    fireEvent.click(trigger);
    expect(screen.getByRole('note').textContent).toBe(
      `${TAG.explanation} This reading is tentative: other readings are nearly as likely.`,
    );
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
    // The card draws a chord-chart window rather than the whole neck, so the position to aim at has
    // to be one the window contains: the seventh string, at a fret the other six already sit across.
    // Addressed by name rather than by counting, because how many positions come before it depends
    // on how wide the window is, and the window widens when the box is selected.
    const view = getBoxView(full, state().settings);
    const target = container.querySelector(`[data-position="6:${view.window.first}"]`);
    expect(target, 'the window should reach the seventh string').not.toBeNull();

    // A position with nothing drawn on it is one rect and has no circle inside it to aim at.
    fireEvent.click(target as Element);
    expect(screen.getByRole('status').textContent).toContain(`${MAX_CHORD_NOTES} notes at most`);
  });

  it('has no axe violations', async () => {
    const { container } = renderCard({ tag: TAG });
    expect(await axeRuleIds(container)).toEqual([]);
  });

  it('has no axe violations without the analysis, when the chip is not a button', async () => {
    const { container } = renderCard({ tag: null });
    expect(await axeRuleIds(container)).toEqual([]);
  });

  it('keeps the function tag out of the header, so a tagged box and an untagged one line their boards up', () => {
    const box = seedBox();
    // jsdom draws nothing, so the height itself cannot be measured; the structure that guarantees it
    // can be. A header holding the same elements whether or not the box has a tag lays out to the
    // same height, and the board below it therefore starts at the same place in every card.
    const tagged = renderCard({ box, tag: TAG });
    const untagged = renderCard({ box, tag: null });
    const header = (rendered: { container: HTMLElement }) => {
      const found = rendered.container.querySelector('.box-header');
      if (!found) throw new Error('the card drew no header');
      return found;
    };

    expect(tagged.container.querySelector('.function-tag')).not.toBeNull();
    expect(header(tagged).querySelector('.function-tag')).toBeNull();
    expect(header(tagged).innerHTML).toBe(header(untagged).innerHTML);
  });

  it('places the analysis by the orientation the card draws, not by the preset, so exports follow their own', () => {
    // The preset is vertical, so the tag goes under the board...
    expect(state().orientation).toBe('vertical');
    const down = renderCard({ tag: TAG });
    expect(down.container.querySelector('.box-body')?.className).toContain('is-vertical');
    expect(down.container.querySelector('.box-body > .box-analysis')).not.toBeNull();

    // ...while an export drawing the same box horizontally puts it beside the board instead.
    const across = renderCard({ tag: TAG, orientation: 'horizontal' });
    expect(across.container.querySelector('.box-body')?.className).toContain('is-horizontal');
  });

  it('draws the analysis after the board, so reading and focus order follow the picture', () => {
    const { container } = renderCard({ tag: TAG });
    const body = container.querySelector('.box-body');
    const children = [...(body?.children ?? [])].map((child) => child.className);
    expect(children).toEqual(['fretboard-scroll', 'box-analysis']);
  });

  it('does not restate the numeral in the function tag', () => {
    const { container } = renderCard({ tag: TAG });
    const numeral = container.querySelector('.box-numeral')?.textContent?.trim();
    // FunctionText prints the label twice, once visually hidden; the hidden copy is the plain text.
    const fn = container.querySelector('.function-tag .visually-hidden')?.textContent?.trim();
    expect(numeral && fn?.startsWith(numeral)).toBeFalsy();
  });

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
