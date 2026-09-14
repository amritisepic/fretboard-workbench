/** Research corpora read for offline evaluation (docs/harmonic-analysis-plan.md §3.6). The data itself is never committed. */

import type { ChordEvidence, PitchClass } from '../theory';

/** A key as a corpus annotates it. Some corpora give only the tonic. */
export interface CorpusKey {
  readonly tonic: PitchClass;
  readonly mode: 'major' | 'minor' | null;
}

export interface CorpusChord {
  /** The chord as the app would identify it from its notes. */
  readonly evidence: ChordEvidence;
  /** The label as written in the corpus, for reports. */
  readonly label: string;
  /** The key annotated at this chord: the prevailing key, not a tonicization. */
  readonly key: CorpusKey;
  /** For an applied chord (V/x), the key of its target. */
  readonly target: CorpusKey | null;
  /** A pivot chord annotated in two keys: the other one. */
  readonly pivot?: CorpusKey;
}

export interface CorpusPiece {
  readonly corpus: string;
  readonly id: string;
  readonly analyst?: string;
  readonly chords: readonly CorpusChord[];
}
