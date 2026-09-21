import { describe, expect, it } from 'vitest';
import { createBox, type Box, type FillMode, type Settings } from '../../state/workbench';
import { makeScaleRef, type PitchClass } from '../../theory';
import { buildBoxView, editableWindow, fretWindow, type BoardDot } from '../boardModel';

const settings: Settings = { tuning: [40, 45, 50, 55, 59, 64], fretCount: 24, capo: 0, fretMarkers: true, boardView: 'chart' };

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
    expect(view.scaleName).toBe('C major');
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

  it('carries the window its own dots ask for', () => {
    // C on the A string at 3, E on the D string at 2, A on the G string at 2: frets 2 and 3, grown
    // down to the nut because it is close enough to reach.
    expect(buildBoxView(amOverC, settings).window).toEqual({ first: 0, last: 4 });
    // Fill scale lights every string at some fret in every five, so the window is the whole neck.
    expect(buildBoxView(withFill(amOverC, 'scale'), settings).window).toEqual({ first: 0, last: 24 });
  });
});

/** A position with nothing on it, which is what the window has to ignore. */
const blank = (fret: number, string = 0): BoardDot => ({
  string,
  fret,
  pc: 0 as PitchClass,
  kind: 'empty',
  selected: false,
  label: '',
});
const clicked = (fret: number, string = 0): BoardDot => ({ ...blank(fret, string), kind: 'strong', selected: true });
const filled = (fret: number, string = 0): BoardDot => ({ ...blank(fret, string), kind: 'weak', label: 'A' });

/** Every fret from the capo to the last, as a board's dots cover them. */
const wholeNeck = (capo: number, fretCount: number) =>
  Array.from({ length: fretCount - capo + 1 }, (_, i) => blank(capo + i));

describe('fret window', () => {
  it('starts at the capo and runs the minimum length when nothing is drawn', () => {
    expect(fretWindow(wholeNeck(0, 12), 0, 12)).toEqual({ first: 0, last: 4 });
    expect(fretWindow(wholeNeck(3, 12), 3, 12)).toEqual({ first: 3, last: 7 });
    expect(fretWindow([], 0, 12, 4)).toEqual({ first: 0, last: 3 });
  });

  it('counts a position the map lit as well as one the user clicked', () => {
    // The fill is the whole point of the board it is on; cropping it away would hide the map.
    expect(fretWindow([...wholeNeck(0, 12), filled(9), filled(11)], 0, 12)).toEqual({ first: 8, last: 12 });
    expect(fretWindow([...wholeNeck(0, 12), clicked(9), filled(11)], 0, 12)).toEqual({ first: 8, last: 12 });
  });

  it('spans the drawn frets once they are long enough on their own', () => {
    expect(fretWindow([clicked(5), clicked(9)], 0, 12)).toEqual({ first: 5, last: 9 });
    expect(fretWindow([clicked(2), clicked(11)], 0, 12)).toEqual({ first: 2, last: 11 });
  });

  it('grows a short shape down to the capo when it is near enough to reach', () => {
    // An open-position chord shows the nut rather than floating a fret or two above it.
    expect(fretWindow([clicked(1), clicked(3)], 0, 12)).toEqual({ first: 0, last: 4 });
    expect(fretWindow([clicked(2)], 0, 12)).toEqual({ first: 0, last: 4 });
    expect(fretWindow([clicked(5), clicked(6)], 3, 12)).toEqual({ first: 3, last: 7 });
  });

  it('grows a short shape centre-ish once there is no nut to reach for', () => {
    expect(fretWindow([clicked(7), clicked(8)], 0, 12)).toEqual({ first: 6, last: 10 });
    expect(fretWindow([clicked(9)], 0, 12)).toEqual({ first: 7, last: 11 });
  });

  it('includes the capo whenever a note is played there', () => {
    // A note on an open string is at the capo, which is the lowest fret there is.
    expect(fretWindow([clicked(0), clicked(7)], 0, 12).first).toBe(0);
    expect(fretWindow([clicked(3), clicked(9)], 3, 12).first).toBe(3);
  });

  it('slides back down the neck rather than running off the end of it', () => {
    expect(fretWindow([clicked(12)], 0, 12)).toEqual({ first: 8, last: 12 });
    expect(fretWindow([clicked(11), clicked(12)], 0, 12)).toEqual({ first: 8, last: 12 });
  });

  it('stays inside the neck it is given, however short that neck is', () => {
    expect(fretWindow([], 0, 3)).toEqual({ first: 0, last: 3 });
    expect(fretWindow([clicked(2)], 0, 2)).toEqual({ first: 0, last: 2 });
    expect(fretWindow([clicked(5)], 7, 12)).toEqual({ first: 7, last: 11 });
    // A capo past the end of the neck is nonsense, but it must not produce a backwards window.
    const degenerate = fretWindow([], 14, 12);
    expect(degenerate.last).toBeGreaterThanOrEqual(degenerate.first);
  });
});

describe('the room a board being edited keeps around the shape', () => {
  it('reaches further up the neck than down, so a shape can be moved past the window it opened on', () => {
    // Without reach upwards a new box is stuck on the first five frets forever: the window comes
    // from the notes, so no click inside it can ever push it higher.
    expect(editableWindow({ first: 0, last: 4 }, 0, 24)).toEqual({ first: 0, last: 6 });
    expect(editableWindow({ first: 7, last: 11 }, 0, 24)).toEqual({ first: 6, last: 13 });
  });

  it('stays on the neck at either end', () => {
    expect(editableWindow({ first: 0, last: 4 }, 0, 24).first).toBe(0);
    expect(editableWindow({ first: 3, last: 7 }, 3, 24).first).toBe(3);
    expect(editableWindow({ first: 20, last: 24 }, 0, 24)).toEqual({ first: 19, last: 24 });
  });

  it('never hands back a backwards window, whatever neck it is given', () => {
    const degenerate = editableWindow({ first: 0, last: 4 }, 14, 12);
    expect(degenerate.last).toBeGreaterThanOrEqual(degenerate.first);
  });
});
