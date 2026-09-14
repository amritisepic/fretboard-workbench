// Test helper: chords from symbols ("B♭m7", "C/G", "F♯7(11)"), voiced with the bass lowest.
import { CHORD_TYPES, chordCandidateKey, identifyChord } from '../chords';
import type { ChordEvidence } from '../keys';
import { pcOf, pcSet } from '../pitch';
import { parseSpelled, pcOfSpelled } from '../spelling';

const ALIASES: readonly [RegExp, string][] = [
  [/^(ø7?|m7b5)$/, 'm7♭5'],
  [/^(°7|o7)$/, 'dim7'],
  [/^(°|o)$/, 'dim'],
  [/^(Δ7?|M7|ma7)$/, 'maj7'],
  [/^\+$/, 'aug'],
  [/^(min|-)$/, 'm'],
  [/^-7$/, 'm7'],
];

export function chordFromSymbol(symbol: string): ChordEvidence {
  const match = /^([A-G][♭♯b#]?)([^/]*)(?:\/([A-G][♭♯b#]?))?$/.exec(symbol.trim());
  if (!match) throw new Error(`Unreadable chord symbol "${symbol}"`);
  const root = pcOfSpelled(parseSpelled(match[1]));
  let suffix = match[2].replace(/b(?=\d)/g, '♭').replace(/#/g, '♯');
  for (const [pattern, replacement] of ALIASES) if (pattern.test(suffix)) suffix = replacement;
  const type = CHORD_TYPES.find((t) => t.suffix === suffix);
  if (!type) throw new Error(`Unknown chord suffix "${suffix}" in "${symbol}"`);
  const bass = match[3] ? pcOfSpelled(parseSpelled(match[3])) : root;
  const bassMidi = 40 + ((bass - 4 + 12) % 12);
  const rootMidi = bassMidi + ((root - bass + 12) % 12);
  const pitches = [bassMidi, ...type.intervals.map((iv) => rootMidi + iv + (rootMidi + iv <= bassMidi ? 12 : 0))];
  const unique = [...new Set(pitches)];
  const key = chordCandidateKey(root, type.id, []);
  const chord = identifyChord(unique).find((c) => c.key === key);
  if (!chord) throw new Error(`"${symbol}" did not identify as ${key}`);
  return { chord, pcs: pcSet(unique.map(pcOf)) };
}

export const progression = (symbols: string) => symbols.trim().split(/\s+/).map(chordFromSymbol);
