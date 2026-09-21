import { beforeEach, describe, expect, it } from 'vitest';
import {
  formatSpelled,
  formatTuning,
  keyName,
  makeScaleRef,
  scaleRefName,
  withFamilyMode,
  withTonic,
} from '../../theory';
import { useWorkbench } from '../workbench';

const initial = useWorkbench.getState();
const state = () => useWorkbench.getState();
const firstBox = () => state().boxes[0];

describe('workbench store', () => {
  beforeEach(() => {
    useWorkbench.setState(initial, true);
  });

  it('starts empty with standard tuning, 12 frets, no capo, vertical chart necks and in edit mode', () => {
    expect(state().boxes).toEqual([]);
    expect(formatTuning(state().settings.tuning)).toBe('E2 A2 D3 G3 B3 E4');
    expect(state().settings.fretCount).toBe(12);
    expect(state().viewing).toBe(false);
    expect(state().settings.capo).toBe(0);
    expect(state().settings.fretMarkers).toBe(true);
    expect(state().settings.boardView).toBe('chart');
    expect(state().orientation).toBe('vertical');
  });

  it('turns the fret markers off and on', () => {
    state().setFretMarkers(false);
    expect(state().settings.fretMarkers).toBe(false);
    state().setFretMarkers(true);
    expect(state().settings.fretMarkers).toBe(true);
  });

  it('adds and selects a box with a red, unfilled, C major default', () => {
    const id = state().addBox();
    expect(state().selectedBoxId).toBe(id);
    expect(firstBox()).toMatchObject({
      color: '#C8372D',
      labelMode: 'names',
      degreeBasis: 'key',
      fill: { on: false, mode: 'inversion' },
    });
    state().selectBox(null);
    expect(state().selectedBoxId).toBeNull();
  });

  it('keeps one clicked note per string, moving it along the string', () => {
    const id = state().addBox();
    expect(state().togglePosition(id, { string: 0, fret: 3 })).toBe(true);
    expect(state().togglePosition(id, { string: 1, fret: 2 })).toBe(true);
    expect(state().togglePosition(id, { string: 0, fret: 5 })).toBe(true);
    expect(firstBox().positions).toEqual([{ string: 1, fret: 2 }, { string: 0, fret: 5 }]);
    state().togglePosition(id, { string: 0, fret: 5 });
    expect(firstBox().positions).toEqual([{ string: 1, fret: 2 }]);
  });

  it('refuses a seventh note on an instrument with more strings', () => {
    state().setStringCount(8);
    const id = state().addBox();
    for (let string = 0; string < 6; string++) expect(state().togglePosition(id, { string, fret: 2 })).toBe(true);
    expect(state().togglePosition(id, { string: 6, fret: 2 })).toBe(false);
    expect(firstBox().positions).toHaveLength(6);
    expect(state().togglePosition(id, { string: 5, fret: 4 })).toBe(true);
    state().togglePosition(id, { string: 5, fret: 4 });
    expect(state().togglePosition(id, { string: 6, fret: 2 })).toBe(true);
  });

  it('moves the fill switch, turns the fill on when a mode is chosen, and toggles', () => {
    const id = state().addBox();
    state().setFillMode(id, 'scale');
    expect(firstBox().fill).toEqual({ on: true, mode: 'scale' });
    state().toggleFill(id);
    expect(firstBox().fill).toEqual({ on: false, mode: 'scale' });
    state().setFillOn(id, true);
    expect(firstBox().fill.on).toBe(true);
  });

  it('adds strings at the low end and keeps clicked notes on their strings', () => {
    const id = state().addBox();
    state().togglePosition(id, { string: 0, fret: 3 });
    state().setStringCount(7);
    expect(formatTuning(state().settings.tuning)).toBe('B1 E2 A2 D3 G3 B3 E4');
    expect(firstBox().positions).toEqual([{ string: 1, fret: 3 }]);
    state().setStringCount(5);
    expect(formatTuning(state().settings.tuning)).toBe('A2 D3 G3 B3 E4');
    expect(firstBox().positions).toEqual([]);
  });

  it('applies tuning presets aligned at the high string', () => {
    const id = state().addBox();
    state().togglePosition(id, { string: 5, fret: 0 });
    state().applyTuning([35, 40, 45, 50, 55, 59, 64]);
    expect(firstBox().positions).toEqual([{ string: 6, fret: 0 }]);
  });

  it('edits one string pitch', () => {
    state().setStringPitch(0, 38);
    expect(formatTuning(state().settings.tuning)).toBe('D2 A2 D3 G3 B3 E4');
  });

  it('clamps the fret count and drops notes above the last fret', () => {
    const id = state().addBox();
    state().togglePosition(id, { string: 2, fret: 15 });
    state().togglePosition(id, { string: 3, fret: 4 });
    state().setFretCount(40);
    expect(state().settings.fretCount).toBe(30);
    state().setFretCount(12);
    expect(state().settings.fretCount).toBe(12);
    expect(firstBox().positions).toEqual([{ string: 3, fret: 4 }]);
  });

  it('moves shapes, scales, chord picks and the key with the capo, keeping the tuning', () => {
    const id = state().addBox();
    for (const p of [{ string: 1, fret: 3 }, { string: 2, fret: 2 }, { string: 3, fret: 0 }]) state().togglePosition(id, p);
    state().setChordOverride(id, '0:maj:');
    state().setCapo(2);
    expect(state().settings.capo).toBe(2);
    expect(state().settings.tuning).toEqual(initial.settings.tuning);
    expect(firstBox().positions).toEqual([{ string: 1, fret: 5 }, { string: 2, fret: 4 }, { string: 3, fret: 2 }]);
    expect(scaleRefName(firstBox().scale)).toBe('D major');
    expect(firstBox().chordOverride).toBe('2:maj:');
    expect(keyName(state().key)).toBe('D major');
    state().setCapo(0);
    expect(firstBox().positions).toEqual([{ string: 1, fret: 3 }, { string: 2, fret: 2 }, { string: 3, fret: 0 }]);
    expect(keyName(state().key)).toBe('C major');
    state().setCapo(40);
    expect(state().settings.capo).toBe(11);
    expect(firstBox().positions.every((p) => p.fret >= 11)).toBe(true);
  });

  it('shifts every box and the key together, keeping shapes above the capo', () => {
    const a = state().addBox();
    const b = state().addBox();
    state().togglePosition(a, { string: 0, fret: 3 });
    state().togglePosition(b, { string: 1, fret: 0 });
    state().transposeAll(-2);
    expect(state().boxes.map((box) => box.positions)).toEqual([[{ string: 0, fret: 1 }], [{ string: 1, fret: 10 }]]);
    expect(state().boxes.map((box) => scaleRefName(box.scale))).toEqual(['B♭ major', 'B♭ major']);
    expect(keyName(state().key)).toBe('B♭ major');
    state().setCapo(1);
    expect(state().boxes.map((box) => box.positions)).toEqual([[{ string: 0, fret: 2 }], [{ string: 1, fret: 11 }]]);
    state().transposeAll(-2); // fret 0 would sit behind the capo, so that shape goes up an octave instead
    expect(state().boxes.map((box) => box.positions)).toEqual([[{ string: 0, fret: 12 }], [{ string: 1, fret: 9 }]]);
  });

  it('enters view mode, deselecting the box, and returns to editing', () => {
    const id = state().addBox();
    expect(state().selectedBoxId).toBe(id);
    state().setViewing(true);
    expect(state().viewing).toBe(true);
    expect(state().selectedBoxId).toBeNull();
    state().setViewing(false);
    expect(state().viewing).toBe(false);
  });

  it('switches the neck orientation', () => {
    state().setOrientation('horizontal');
    expect(state().orientation).toBe('horizontal');
  });

  it('switches the board between the chord-chart window and the whole neck', () => {
    state().setBoardView('full');
    expect(state().settings.boardView).toBe('full');
    state().setBoardView('chart');
    expect(state().settings.boardView).toBe('chart');
  });

  it('sets the key and the found scales and chord picks in one change', () => {
    const a = state().addBox();
    const b = state().addBox();
    state().setChordOverride(b, '9:min:');
    state().setKeyAndScales(makeScaleRef('diatonic', 5, 'C'), [{ id: a, scale: makeScaleRef('diatonic', 1, 'D'), chordOverride: '2:m7:' }]);
    expect(keyName(state().key)).toBe('C minor');
    expect(scaleRefName(firstBox().scale)).toBe('D Dorian');
    expect(firstBox().chordOverride).toBe('2:m7:');
    expect(state().boxes[1]).toMatchObject({ chordOverride: '9:min:' });
    expect(scaleRefName(state().boxes[1].scale)).toBe('C major');
  });

  it('transposes notes, scale and chord override together from the root box', () => {
    const id = state().addBox();
    for (const p of [{ string: 1, fret: 3 }, { string: 2, fret: 2 }, { string: 3, fret: 2 }]) state().togglePosition(id, p);
    state().setChordOverride(id, '0:6:5');
    state().transposeBox(id, 1);
    expect(firstBox().positions).toEqual([{ string: 1, fret: 4 }, { string: 2, fret: 3 }, { string: 3, fret: 3 }]);
    expect(scaleRefName(firstBox().scale)).toBe('D♭ major');
    expect(firstBox().chordOverride).toBe('1:6:5');
    state().transposeBox(id, -1);
    state().transposeBox(id, -1);
    expect(firstBox().positions).toEqual([{ string: 1, fret: 2 }, { string: 2, fret: 1 }, { string: 3, fret: 1 }]);
    expect(scaleRefName(firstBox().scale)).toBe('B major');
    expect(firstBox().chordOverride).toBe('11:6:5');
  });

  it('wraps a shape at the nut up an octave instead of dropping notes', () => {
    state().setFretCount(24);
    const id = state().addBox();
    state().togglePosition(id, { string: 0, fret: 0 });
    state().togglePosition(id, { string: 1, fret: 2 });
    state().transposeBox(id, -1);
    expect(firstBox().positions).toEqual([{ string: 0, fret: 11 }, { string: 1, fret: 13 }]);
  });

  it('keeps a preset key and strip settings, and starts new boxes in the key in effect at the end', () => {
    expect(keyName(state().key)).toBe('C major');
    expect(state().strips).toEqual({ commonTones: true, voiceLeading: true, labelMode: 'names', analysis: false, notation: 'jazz' });
    state().setStrips({ labelMode: 'degrees', commonTones: false, analysis: true, notation: 'classical' });
    expect(state().strips).toEqual({ commonTones: false, voiceLeading: true, labelMode: 'degrees', analysis: true, notation: 'classical' });

    const first = state().addBox();
    expect(scaleRefName(firstBox().scale)).toBe('C major');
    state().setScale(first, makeScaleRef('diatonic', 3, 'A♭')); // alters C major into C minor
    const second = state().addBox();
    expect(scaleRefName(state().boxes[1].scale)).toBe('C minor');
    expect(state().selectedBoxId).toBe(second);

    state().setKey(makeScaleRef('diatonic', 5, 'A'));
    expect(keyName(state().key)).toBe('A minor');
  });

  it('edits the reference scale: tonic, family and mode', () => {
    const id = state().addBox();
    state().setScale(id, withTonic(firstBox().scale, 2));
    expect(scaleRefName(firstBox().scale)).toBe('D major');
    state().setScale(id, withFamilyMode(firstBox().scale, 'harmonicMinor', 0));
    expect(scaleRefName(firstBox().scale)).toBe('D Harmonic Minor');
    state().setMode(id, 4);
    expect(scaleRefName(firstBox().scale)).toBe('A Phrygian Dominant');
    state().setScale(id, makeScaleRef('diatonic', 6, 'B'));
    expect(scaleRefName(firstBox().scale)).toBe('B Locrian');
    expect(formatSpelled(firstBox().scale.tonic)).toBe('B');
  });

  it('stores the chord-name pick and the dot color', () => {
    const id = state().addBox();
    state().setChordOverride(id, '9:min:');
    expect(firstBox().chordOverride).toBe('9:min:');
    state().setChordOverride(id, null);
    expect(firstBox().chordOverride).toBeNull();
    state().setColor(id, '#2F5FB3');
    expect(firstBox().color).toBe('#2F5FB3');
    state().setDegreeBasis(id, 'scale');
    expect(firstBox().degreeBasis).toBe('scale');
  });

  it('names, loads, marks, detaches and restarts the document', () => {
    expect(state().document).toEqual({ presetId: null, name: 'Untitled preset', savedSnapshot: null });
    state().setPresetName('  Blues in F  ');
    expect(state().document.name).toBe('Blues in F');
    state().setPresetName('   ');
    expect(state().document.name).toBe('Blues in F');

    state().addBox();
    state().markSaved('p1', 'Blues in F', 'snapshot');
    expect(state().document).toEqual({ presetId: 'p1', name: 'Blues in F', savedSnapshot: 'snapshot' });
    state().detachDocument();
    expect(state().document).toEqual({ presetId: null, name: 'Blues in F', savedSnapshot: null });

    state().setOrientation('horizontal');
    state().setBoardView('full');
    const { settings, key, strips, orientation, boxes } = state();
    state().newDocument();
    expect(state().boxes).toEqual([]);
    expect(state().orientation).toBe('vertical');
    expect(state().settings.boardView).toBe('chart');
    expect(state().document.name).toBe('Untitled preset');
    state().loadDocument({
      presetId: 'p2',
      name: 'Loaded',
      savedSnapshot: 's',
      data: { settings, key, strips, orientation, boxes },
    });
    expect(state().orientation).toBe('horizontal');
    expect(state().settings.boardView).toBe('full');
    expect(state().boxes).toBe(boxes);
    expect(state().selectedBoxId).toBeNull();
    expect(state().document).toEqual({ presetId: 'p2', name: 'Loaded', savedSnapshot: 's' });
  });

  it('pins a key and a reading, moving the key pin with the box', () => {
    const id = state().addBox();
    expect(firstBox()).toMatchObject({ keyPin: null, readingPin: null });
    state().setKeyPin(id, makeScaleRef('diatonic', 0, 'D♭'));
    state().setReadingPin(id, 'secondaryDominant:4major:5major:0:-');
    state().transposeBox(id, 2);
    expect(firstBox().keyPin && keyName(firstBox().keyPin!)).toBe('E♭ major');
    expect(firstBox().readingPin).toBe('secondaryDominant:4major:5major:0:-');
    state().transposeAll(-2);
    expect(firstBox().keyPin && keyName(firstBox().keyPin!)).toBe('D♭ major');
    state().setKeyPin(id, null);
    state().setReadingPin(id, null);
    expect(firstBox()).toMatchObject({ keyPin: null, readingPin: null });
  });

  it('removes the selected box and clears the selection', () => {
    const id = state().addBox();
    state().removeBox(id);
    expect(state().boxes).toEqual([]);
    expect(state().selectedBoxId).toBeNull();
  });
});
