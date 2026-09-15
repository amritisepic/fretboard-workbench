/** Chord symbols as lead sheets write them ("B♭m7", "C/G", "Dø7", "G7b9"), read into the workbench's chord types. */

import { CHORD_TYPES, type ChordType } from './chords';
import { parseSpelled, type SpelledPc } from './spelling';

export interface ChordSymbol {
  readonly root: SpelledPc;
  readonly type: ChordType;
  /** The lowest note when it isn't the root, as in C/G. */
  readonly bass: SpelledPc | null;
}

/** Common spellings of a suffix, rewritten to the workbench's own (CHORD_TYPES). */
const ALIASES: readonly (readonly [RegExp, string])[] = [
  [/^(ø7?|-7♭5|min7♭5)$/, 'm7♭5'],
  [/^(°7|o7)$/, 'dim7'],
  [/^(°|o)$/, 'dim'],
  [/^(Δ7?|M7|ma7)$/, 'maj7'],
  [/^\+$/, 'aug'],
  [/^(min|-)$/, 'm'],
  [/^-7$/, 'm7'],
  [/^(mMaj7|mM7|-Δ7?)$/, 'm(maj7)'],
  [/^sus$/, 'sus4'],
  [/^7sus$/, '7sus4'],
  [/^9sus$/, '9sus4'],
  [/^69$/, '6/9'],
  [/^(7\+5?|\+7)$/, '7♯5'],
];

export function parseChordSymbol(symbol: string): ChordSymbol {
  const match = /^([A-G][♭♯b#]?)([^/]*)(?:\/([A-G][♭♯b#]?))?$/.exec(symbol.trim());
  if (!match) throw new Error(`Unreadable chord symbol "${symbol}"`);
  let suffix = match[2].replace(/b(?=\d)/g, '♭').replace(/#/g, '♯');
  const alias = ALIASES.find(([pattern]) => pattern.test(suffix));
  if (alias) suffix = alias[1];
  const type = CHORD_TYPES.find((t) => t.suffix === suffix);
  if (!type) throw new Error(`Unknown chord suffix "${suffix}" in "${symbol}"`);
  return { root: parseSpelled(match[1]), type, bass: match[3] ? parseSpelled(match[3]) : null };
}
