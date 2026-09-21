/** Turns the example progressions (data/examples.ts) into presets the workbench opens. */

import { EXAMPLE_FOLDERS, type ExampleFolder, type ExampleProgression } from '../data/examples';
import { TUNING_PRESETS } from '../data/tunings';
import {
  DEFAULT_FRET_COUNT,
  functionScale,
  identifyChord,
  makeScaleRef,
  parseChordSymbol,
  pitchesAt,
  scaleRefPcSet,
  voiceChord,
  type Midi,
  type ScaleRef,
} from '../theory';
import { boxChord, keyPlanOf } from './boxChords';
import type { PresetData } from './presetFormat';
import { snapshotOf } from './presetFormat';
import { DEFAULT_STRIPS, createBox, type Box, type LoadedDocument, type Settings } from './workbench';

export { EXAMPLE_FOLDERS };

const KEY_MODES: Readonly<Record<string, number>> = {
  major: 0,
  dorian: 1,
  phrygian: 2,
  lydian: 3,
  mixolydian: 4,
  minor: 5,
  locrian: 6,
};

/** "A♭ major", "D Dorian". */
export function parseExampleKey(text: string): ScaleRef {
  const [tonic, mode = ''] = text.trim().split(/\s+/);
  const index = KEY_MODES[mode.toLowerCase()];
  if (index === undefined) throw new Error(`Unknown key "${text}"`);
  return makeScaleRef('diatonic', index, tonic);
}

export function exampleChordSymbols(example: ExampleProgression): string[] {
  return example.chords.split(/\s+/).filter((token) => token !== '' && token !== '|');
}

/**
 * An example as a preset: standard tuning, 12 frets, vertical necks, harmonic analysis on. Each chord
 * is voiced in the folder's style, moving smoothly from the one before. The key is the example's own,
 * and each box gets the scale its chord's function suggests, as Find key would give it. A chord whose
 * notes would be named otherwise under that scale keeps its written name as the box's chord pick.
 */
export function buildExample(example: ExampleProgression, folder: ExampleFolder): PresetData {
  // The examples are what a first-time reader meets, so they open the way a new preset does: a
  // chord-chart window around each shape rather than the whole neck.
  const settings: Settings = {
    tuning: TUNING_PRESETS[0].tuning,
    fretCount: DEFAULT_FRET_COUNT,
    capo: 0,
    fretMarkers: true,
    boardView: 'chart',
  };
  const key = parseExampleKey(example.key);

  let previous: Midi[] | null = null;
  const written: Box[] = exampleChordSymbols(example).map((text) => {
    const voicing = voiceChord(parseChordSymbol(text), settings.tuning, folder.style, previous);
    if (!voicing) throw new Error(`No voicing for "${text}" in "${example.name}"`);
    previous = pitchesAt(settings.tuning, voicing.positions);
    return { ...createBox(key), positions: voicing.positions, chordOverride: voicing.chordKey };
  });

  const plan = keyPlanOf(key, written, settings);
  const boxes = written.map((box, i): Box => {
    const { pcs, pitches, chord } = boxChord(box, settings);
    if (!chord) return box;
    const scale = functionScale(pcs, chord, plan.analysis.boxes[i]);
    const automatic = identifyChord(pitches, { scale: scaleRefPcSet(scale) })[0];
    return { ...box, scale, chordOverride: automatic?.key === box.chordOverride ? null : box.chordOverride };
  });

  return { settings, key, strips: { ...DEFAULT_STRIPS, analysis: true }, orientation: 'vertical', boxes };
}

/**
 * An example opened as an unsaved document. Its snapshot is kept so browsing from one example to the
 * next doesn't ask about discarding changes until one has been edited.
 */
export function exampleDocument(example: ExampleProgression, folder: ExampleFolder): LoadedDocument {
  const data = buildExample(example, folder);
  return { presetId: null, name: example.name, savedSnapshot: snapshotOf(example.name, data), data };
}
