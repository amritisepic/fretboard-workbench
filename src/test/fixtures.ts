/**
 * Shared setup for the component tests: resetting the stores between tests, and building real
 * workbench content to render.
 *
 * Fixtures come from the built-in examples rather than from hand-written boxes, so a test renders
 * the same data a user would see and can't drift from what the app actually produces.
 */

import { TUNING_PRESETS } from '../data/tunings';
import { EXAMPLE_FOLDERS, exampleDocument } from '../state/examples';
import { useLibrary } from '../state/library';
import { usePreferences } from '../state/preferences';
import { useScaleWizard } from '../state/scaleWizard';
import { createBox, useWorkbench, type Box, type Settings } from '../state/workbench';
import { DEFAULT_FRET_COUNT, makeScaleRef, type FretPosition } from '../theory';

const initialWorkbench = useWorkbench.getState();
const initialLibrary = useLibrary.getState();
const initialPreferences = usePreferences.getState();
const initialWizard = useScaleWizard.getState();

/** Back to a first-run app, with the tour already seen so it doesn't offer itself. */
export function resetStores(): void {
  useWorkbench.setState(initialWorkbench, true);
  useLibrary.setState(initialLibrary, true);
  usePreferences.setState({ ...initialPreferences, tourSeen: true }, true);
  useScaleWizard.setState(initialWizard, true);
}

export const testSettings: Settings = {
  tuning: TUNING_PRESETS[0].tuning,
  fretCount: DEFAULT_FRET_COUNT,
  capo: 0,
  fretMarkers: true,
};

/** A box holding the given positions, in C major, for rendering a board on its own. */
export function boxWithPositions(positions: readonly FretPosition[]): Box {
  return { ...createBox(makeScaleRef('diatonic', 0, 'C')), positions };
}

/** An open C major triad: one note on each of the low four strings. */
export const C_MAJOR_POSITIONS: readonly FretPosition[] = [
  { string: 1, fret: 3 },
  { string: 2, fret: 2 },
  { string: 3, fret: 0 },
  { string: 4, fret: 1 },
];

function findExample(name: string) {
  for (const folder of EXAMPLE_FOLDERS) {
    const example = folder.examples.find((e) => e.name === name);
    if (example) return { example, folder };
  }
  throw new Error(`No built-in example named "${name}"`);
}

/**
 * Loads a built-in example into the workbench, as opening it from the Presets panel does.
 * Returns the number of boxes so a test can assert against it without restating the changes.
 */
export function openExample(name: string): number {
  const { example, folder } = findExample(name);
  const document = exampleDocument(example, folder);
  useWorkbench.getState().loadDocument(document);
  return document.data.boxes.length;
}

/** The fixtures the tests use, named once so the sizes they stand for stay visible. */
export const FIXTURES = {
  /** Four chords, one key, no analysis surprises. */
  short: 'I–V–vi–IV',
  /** 31 boxes: the longest thing a user is likely to open, and the perf case. */
  long: 'Autumn Leaves',
  /** Modal mixture and an ambiguous key, so the key bar splits. */
  ambiguous: 'All Blues',
} as const;
