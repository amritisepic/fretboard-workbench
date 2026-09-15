// Test helper: chords from symbols ("B♭m7", "C/G", "F♯7(11)"), voiced with the bass lowest.
import { chordCandidateKey, identifyChord } from '../chords';
import { parseChordSymbol } from '../chordSymbols';
import type { ChordEvidence } from '../keys';
import { pcOf, pcSet } from '../pitch';
import { pcOfSpelled } from '../spelling';

export function chordFromSymbol(symbol: string): ChordEvidence {
  const parsed = parseChordSymbol(symbol);
  const { type } = parsed;
  const root = pcOfSpelled(parsed.root);
  const bass = parsed.bass ? pcOfSpelled(parsed.bass) : root;
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
