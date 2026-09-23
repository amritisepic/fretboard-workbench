// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import css from '../../styles.css?inline';
import { useWorkbench } from '../../state/workbench';
import { axeRuleIds } from '../../test/axe';
import { FIXTURES, openExample, resetStores } from '../../test/fixtures';
import type { AnalysisLane } from '../analysisModel';
import { buildCanvasModel } from '../canvasModel';
import { buildStripView, type StripView } from '../stripModel';
import { VoiceLeadingStrip } from '../VoiceLeadingStrip';

/**
 * Every strip of the example currently loaded, in order. The canvas model is built once: it analyzes
 * the whole progression, so building it per strip made a 31-chord fixture slow enough to time out.
 */
function allStrips(): StripView[] {
  const { boxes, settings, key, strips } = useWorkbench.getState();
  const { entries } = buildCanvasModel(boxes, settings, key);
  return entries.slice(1).map((to, i) => buildStripView(entries[i], to, strips));
}

/** The first strip in the example that holds some voices and moves others: the interesting shape. */
function mixedStrip(): StripView {
  const strip = allStrips().find((s) => s.held.length > 0 && s.moves.length > 0);
  if (!strip) throw new Error('No transition in the fixture both holds and moves voices');
  return strip;
}

const EMPTY_LANE: AnalysisLane = { relations: [], patterns: [] };

const renderStrip = (strip: StripView, lane: AnalysisLane | null = null) =>
  render(<VoiceLeadingStrip strip={strip} voices lane={lane} wrapped={false} />);

/** The body of the last `@media (max-width: 760px)` block, where the phone layout is set. */
function phoneBlock(): string {
  const start = css.lastIndexOf('@media (max-width: 760px)');
  expect(start, 'the phone breakpoint moved; this test tracks it').toBeGreaterThan(-1);
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  throw new Error('The phone media query is not closed');
}

/**
 * `.selector { ... }` from a block, with its whitespace flattened so it can be matched on. The
 * selector has to start its line, so `.strip-sep` does not match `.export-sheet .strip-sep`.
 */
function rule(block: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`\\n\\s*${escaped} \\{`).exec(block);
  if (!match) throw new Error(`No rule for ${selector} in the phone block`);
  return block.slice(match.index, block.indexOf('}', match.index)).replace(/\s+/g, ' ');
}

describe('VoiceLeadingStrip', () => {
  beforeEach(resetStores);

  describe('the ordinary strip', () => {
    it('draws an arrow only for the voices that move, and a mark for each one held', () => {
      openExample(FIXTURES.long);
      const strip = mixedStrip();
      const { container } = renderStrip(strip);

      expect(container.querySelectorAll('.strip-move')).toHaveLength(strip.moves.length);
      expect(container.querySelectorAll('.strip-dot')).toHaveLength(strip.held.length);
      // The point of the redesign: held voices cost a dot each, not a row each.
      expect(container.querySelectorAll('.strip-move').length).toBeLessThan(strip.voices.length);
    });

    it('names both ends of a moving voice and the size of the move', () => {
      openExample(FIXTURES.long);
      const strip = mixedStrip();
      const move = strip.moves.find((v) => v.kind === 'step' || v.kind === 'leap');
      if (!move || move.from === null || move.to === null) throw new Error('No stepping voice in the fixture');
      const { container } = renderStrip(strip);

      const row = container.querySelector('.strip-move');
      const text = row?.textContent ?? '';
      expect(text).toContain(move.from);
      expect(text).toContain(move.to);
      expect(text).toContain(move.interval);
    });

    it('says which way each voice went, so direction does not rest on the sign alone', () => {
      openExample(FIXTURES.long);
      const { container } = renderStrip(mixedStrip());
      const glyphs = [...container.querySelectorAll('.strip-glyph')].map((g) => g.textContent);
      expect(glyphs.length).toBeGreaterThan(0);
      expect(glyphs.every((g) => g === '↗' || g === '↘' || g === '×' || g === '+')).toBe(true);
    });

    it('keeps every fact in the accessible text, including the names the dots stand for', () => {
      openExample(FIXTURES.long);
      const strip = mixedStrip();
      const { container } = renderStrip(strip);

      const spoken = container.querySelector('.visually-hidden')?.textContent ?? '';
      expect(spoken).toBe(strip.description);
      // A held voice is a nameless dot on screen, so its name has to be here.
      for (const label of strip.heldLabels) expect(spoken).toContain(`${label} stays`);
      for (const move of strip.moves.filter((v) => v.kind === 'step' || v.kind === 'leap')) {
        expect(spoken).toContain(`${move.from} moves ${move.interval} to ${move.to}`);
      }
      expect(spoken).toContain(strip.summary);
    });

    it('hides the drawn forms from assistive technology so nothing is announced twice', () => {
      openExample(FIXTURES.long);
      const { container } = renderStrip(mixedStrip());
      expect(container.querySelector('.strip-voices')?.getAttribute('aria-hidden')).toBe('true');
      expect(container.querySelector('.strip-summary')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('has no accessibility violations', async () => {
      openExample(FIXTURES.long);
      const { container } = renderStrip(mixedStrip(), {
        relations: [{ id: 'authenticCadence', label: 'V–I', arrow: 'solid', bracket: false }],
        patterns: [{ name: 'ii–V–I', starts: true }],
      });
      expect(await axeRuleIds(container)).toEqual([]);
    });
  });

  describe('the phone form', () => {
    it('states the move in one line of text, which is what the phone layout leaves showing', () => {
      openExample(FIXTURES.long);
      const strip = mixedStrip();
      const { container } = renderStrip(strip);

      const line = container.querySelector('.strip-summary');
      expect(line?.textContent).toBe(strip.summary);
      expect(line?.textContent).toMatch(/^\d+ semitones? · \d+ common$/);
      // Each fact is its own element, so the narrow desktop strip can stack them without a separator.
      expect([...(line?.querySelectorAll('.strip-fact') ?? [])].map((f) => f.textContent)).toEqual(strip.summaryParts);
    });

    it('hides the stacked arrows below the phone breakpoint', () => {
      const block = phoneBlock();
      expect(rule(block, '.strip-voices')).toContain('display: none');
      expect(rule(block, '.strip-sep')).toContain('display: inline');
      // Laid out as a row, the strip's remaining children read as the single line the design asks for.
      expect(rule(block, '.strip')).toContain('flex-direction: row');
    });

    it('puts the full form back for the export sheet, which has no viewport', () => {
      const block = phoneBlock();
      expect(rule(block, '.export-sheet .strip-voices')).toContain('display: flex');
      expect(rule(block, '.export-sheet .strip')).toContain('flex-direction: column');
      expect(rule(block, '.export-sheet .strip-summary')).toContain('flex-direction: column');
      expect(rule(block, '.export-sheet .strip-sep')).toContain('display: none');
    });

    it('has no accessibility violations', async () => {
      openExample(FIXTURES.long);
      const { container } = renderStrip(mixedStrip());
      expect(await axeRuleIds(container)).toEqual([]);
    });
  });

  describe('the analysis lane', () => {
    it('renders nothing at all when it has neither a relation nor a pattern', () => {
      openExample(FIXTURES.long);
      const { container } = renderStrip(mixedStrip(), EMPTY_LANE);

      expect(container.querySelector('.strip-analysis')).toBeNull();
      // The old empty lane printed a bare em dash, which read as a rendering fault.
      expect(container.textContent).not.toContain('—');
    });

    it('renders the relation when there is one', () => {
      openExample(FIXTURES.long);
      const { container } = renderStrip(mixedStrip(), {
        relations: [{ id: 'authenticCadence', label: 'V–I', arrow: 'solid', bracket: false }],
        patterns: [],
      });
      expect(container.querySelector('.strip-analysis')).not.toBeNull();
      expect(container.querySelector('.strip-relation-label')?.textContent).toBe('V–I');
    });

    it('renders a pattern with no relation, and still no dash', () => {
      openExample(FIXTURES.long);
      const { container } = renderStrip(mixedStrip(), { relations: [], patterns: [{ name: 'ii–V–I', starts: true }] });
      expect(container.querySelector('.strip-pattern')?.textContent).toBe('ii–V–I');
      expect(container.querySelector('.strip-relation-label')).toBeNull();
      expect(container.textContent).not.toContain('—');
    });

    it('has no accessibility violations with an empty lane', async () => {
      openExample(FIXTURES.long);
      const { container } = renderStrip(mixedStrip(), EMPTY_LANE);
      expect(await axeRuleIds(container)).toEqual([]);
    });
  });

  describe('when there is nothing to compare', () => {
    it('says so in place of the summary, and draws no voices', () => {
      openExample(FIXTURES.short);
      const [strip] = allStrips();
      if (!strip) throw new Error('The short fixture has no strip');
      const empty: StripView = { ...strip, voices: [], moves: [], held: [], heldLabels: [] };
      const { container } = renderStrip(empty);

      expect(container.querySelector('.strip-voices')).toBeNull();
      expect(container.querySelector('.strip-summary')?.textContent).toBe(strip.emptyText);
    });
  });
});
