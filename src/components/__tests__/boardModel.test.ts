import { describe, expect, it } from 'vitest';
import { createBox, type Box, type FillMode, type Settings } from '../../state/workbench';
import { makeScaleRef } from '../../theory';
import { buildBoxView } from '../boardModel';

const settings: Settings = { tuning: [40, 45, 50, 55, 59, 64], fretCount: 24, capo: 0 };

// C3 on the A string, E3 on the D string, A3 on the G string: C E A with C lowest.
const amOverC: Box = {
  ...createBox(),
  positions: [
    { string: 1, fret: 3 },
    { string: 2, fret: 2 },
    { string: 3, fret: 2 },
  ],
};

const withFill = (box: Box, mode: FillMode, on = true): Box => ({ ...box, fill: { on, mode } });
const CHORD = [0, 4, 9];
const C_MAJOR = [0, 2, 4, 5, 7, 9, 11];

describe('box view', () => {
  it('has one dot per string and fret, open strings included', () => {
    expect(buildBoxView(amOverC, settings).dots).toHaveLength(6 * 25);
  });

  it('names the chord from the clicked notes', () => {
    const view = buildBoxView(amOverC, settings);
    expect(view.title).toBe('Am/C');
    expect(view.scaleName).toBe('C Ionian');
    expect(buildBoxView(createBox(), settings).title).toBe('');
  });

  it('draws only the clicked notes while the fill is off', () => {
    const drawn = buildBoxView(amOverC, settings).dots.filter((d) => d.kind !== 'empty');
    expect(drawn).toHaveLength(3);
    expect(drawn.every((d) => d.selected && d.kind === 'strong')).toBe(true);
  });

  it('fill inversion draws an arpeggio map in the duller shade', () => {
    for (const dot of buildBoxView(withFill(amOverC, 'inversion'), settings).dots) {
      const expected = dot.selected ? 'strong' : CHORD.includes(dot.pc) ? 'weak' : 'empty';
      expect(dot.kind, `${dot.string}:${dot.fret}`).toBe(expected);
    }
  });

  it('fill scale keeps chord tones at full strength and dulls the other scale tones', () => {
    for (const dot of buildBoxView(withFill(amOverC, 'scale'), settings).dots) {
      const expected = CHORD.includes(dot.pc) ? 'strong' : C_MAJOR.includes(dot.pc) ? 'weak' : 'empty';
      expect(dot.kind, `${dot.string}:${dot.fret}`).toBe(expected);
    }
  });

  it('keeps the switch position while the fill is off', () => {
    const drawn = buildBoxView(withFill(amOverC, 'scale', false), settings).dots.filter((d) => d.kind !== 'empty');
    expect(drawn).toHaveLength(3);
  });

  it('labels dots by note name or scale degree', () => {
    const labelOf = (box: Box, pc: number) =>
      buildBoxView(withFill(box, 'scale'), settings).dots.find((d) => d.pc === pc && d.kind !== 'empty')?.label;
    expect([0, 4, 9, 11].map((pc) => labelOf(amOverC, pc))).toEqual(['C', 'E', 'A', 'B']);
    const degrees: Box = { ...amOverC, labelMode: 'degrees' };
    expect([0, 4, 9, 11].map((pc) => labelOf(degrees, pc))).toEqual(['1', '3', '6', '7']);
    expect(buildBoxView(amOverC, settings).dots.filter((d) => d.kind === 'empty').every((d) => d.label === '')).toBe(true);
  });

  it('counts degrees from the key in effect, or from the reference scale when the box asks', () => {
    const inAMinor: Box = { ...withFill(amOverC, 'scale'), labelMode: 'degrees', scale: makeScaleRef('diatonic', 5, 'A') };
    const labels = (box: Box) => {
      const view = buildBoxView(box, settings, makeScaleRef('diatonic', 0, 'C'));
      return [9, 0, 4].map((pc) => view.dots.find((d) => d.pc === pc && d.kind !== 'empty')?.label);
    };
    expect(labels(inAMinor)).toEqual(['6', '1', '3']);
    expect(labels({ ...inAMinor, degreeBasis: 'scale' })).toEqual(['1', '♭3', '5']);
    expect(buildBoxView({ ...inAMinor, labelMode: 'names' }, settings, makeScaleRef('diatonic', 0, 'C')).dots.find((d) => d.pc === 9)?.label).toBe('A');
  });

  it('lists every reading and names the box with the sidebar pick while it matches', () => {
    const view = buildBoxView(amOverC, settings);
    expect(view.candidates.length).toBeGreaterThan(2);
    expect(view.chord?.key).toBe(view.candidates[0].key);

    const picked = buildBoxView({ ...amOverC, chordOverride: '0:6:5' }, settings);
    expect(picked.title).toBe('C6 (no 5)');
    expect(picked.chord?.root).toBe(0);

    const stale = buildBoxView({ ...amOverC, chordOverride: '4:maj:' }, settings);
    expect(stale.title).toBe('Am/C');
  });

  it('ignores positions that fall outside the current board', () => {
    const stray: Box = { ...amOverC, positions: [...amOverC.positions, { string: 7, fret: 2 }, { string: 0, fret: 29 }] };
    expect(buildBoxView(stray, settings).title).toBe('Am/C');
  });

  it('has no dots behind the capo and ignores notes there', () => {
    const capoed = { ...settings, capo: 2 };
    const view = buildBoxView(amOverC, capoed);
    expect(view.dots).toHaveLength(6 * 23);
    expect(view.dots.every((d) => d.fret >= 2)).toBe(true);
    expect(view.title).toBe('Am/C');
    const behind: Box = { ...amOverC, positions: [...amOverC.positions, { string: 0, fret: 1 }] };
    expect(buildBoxView(behind, capoed).title).toBe('Am/C');
  });
});
