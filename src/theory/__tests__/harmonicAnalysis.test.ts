// Evaluation harness (docs/harmonic-analysis-plan.md §3.6): labelled progressions with the keys,
// readings, relations and scales expected of them, and the readings an ambiguous chord must list.
import { describe, expect, it } from 'vitest';
import type { PatternId } from '../../data/harmonyRules';
import { analyzeHarmony, type BoxTag, type ReadingKind, type RelationId } from '../analysis';
import { findKey, functionScale } from '../keyPlan';
import { keyName } from '../keys';
import { makeScaleRef, scaleRefName, type ScaleRef } from '../scales';
import { progression } from './chordSymbols';

interface Fixture {
  readonly name: string;
  /** Chord symbols separated by spaces. */
  readonly chords: string;
  /** The preset key the key bar starts from. Without it the progression is read as Find key reads it. */
  readonly home?: string;
  /** Find key's key. In every spec "|" separates accepted answers and "*" accepts anything. */
  readonly key?: string;
  /** The local key (the key bar) at each box. */
  readonly locals?: readonly string[];
  readonly kinds?: readonly (ReadingKind | '*')[];
  /** Local keys that must appear among a box's reading and its alternatives. */
  readonly lists?: Readonly<Record<number, readonly string[]>>;
  /** Relations that must hold between box i and box i + 1. */
  readonly relations?: Readonly<Record<number, readonly RelationId[]>>;
  readonly tags?: Readonly<Record<number, readonly BoxTag[]>>;
  /** The reference scale Find key gives each box. */
  readonly scales?: readonly string[];
  /** Named patterns that must be found, as [id, first box, last box]. */
  readonly patterns?: readonly (readonly [PatternId, number, number])[];
}

const KEY_MODES: Readonly<Record<string, number>> = { major: 0, dorian: 1, phrygian: 2, lydian: 3, mixolydian: 4, minor: 5 };
const keyRef = (name: string): ScaleRef => {
  const [tonic, mode] = name.split(' ');
  return makeScaleRef('diatonic', KEY_MODES[mode.toLowerCase()], tonic);
};
const accepts = (spec: string, value: string) => spec === '*' || spec.split('|').some((option) => option.trim() === value);

const FIXTURES: readonly Fixture[] = [
  // The user's screenshots (plan §1).
  {
    name: 'ii–iii–IV–V in A♭ major, then two chromatic dominants',
    chords: 'B♭m7 Cm7 D♭maj7 E♭7 A♭7 F7',
    key: 'A♭ major',
    locals: ['A♭ major', 'A♭ major', 'A♭ major', 'A♭ major', 'D♭ major', 'B♭ minor|B♭ major'],
    kinds: ['diatonic', 'diatonic', 'diatonic', 'diatonic', 'secondaryDominant', 'secondaryDominant'],
    lists: { 5: ['B♭ minor', 'B♭ major'] },
    scales: ['B♭ Dorian', 'C Phrygian', 'D♭ Lydian', 'E♭ Mixolydian', 'A♭ Mixolydian', 'F Phrygian Dominant|F Mixolydian ♭6|F Mixolydian'],
  },
  {
    name: 'the same in the key bar, from A♭ major',
    home: 'A♭ major',
    chords: 'B♭m7 Cm7 D♭maj7 E♭7 A♭7 F7',
    locals: ['A♭ major', 'A♭ major', 'A♭ major', 'A♭ major', 'D♭ major', 'B♭ minor|B♭ major'],
    lists: { 5: ['B♭ minor', 'B♭ major'] },
  },

  // Diatonic function.
  {
    name: 'ii–V–I',
    chords: 'Dm7 G7 Cmaj7',
    key: 'C major',
    locals: ['C major', 'C major', 'C major'],
    kinds: ['diatonic', 'diatonic', 'diatonic'],
    relations: { 0: ['twoFive'], 1: ['authenticCadence'] },
    scales: ['D Dorian', 'G Mixolydian', 'C major'],
  },
  {
    name: 'minor i–iv–V–i',
    chords: 'Am Dm E7 Am',
    key: 'A minor',
    locals: ['A minor', 'A minor', 'A minor', 'A minor'],
    relations: { 1: ['predominantToDominant'], 2: ['authenticCadence'] },
    scales: ['A minor', 'D Dorian|D Phrygian|D minor', 'E Phrygian Dominant', 'A minor'],
  },
  {
    name: 'minor ii–V–i',
    chords: 'Dm7♭5 G7 Cm',
    key: 'C minor',
    relations: { 0: ['twoFive'], 1: ['authenticCadence'] },
    scales: ['D Locrian', 'G Phrygian Dominant', 'C minor'],
  },
  { name: 'I–vi–IV–V', chords: 'C Am F G', key: 'C major', locals: ['C major', 'C major', 'C major', 'C major'] },
  { name: 'I–V–vi–IV', chords: 'C G Am F', key: 'C major', relations: { 1: ['deceptiveCadence'] } },
  { name: 'deceptive cadence', chords: 'C F G7 Am', key: 'C major', relations: { 2: ['deceptiveCadence'] } },
  { name: 'cadential 6/4', chords: 'C/G G7 C', key: 'C major', relations: { 0: ['cadential64'], 1: ['authenticCadence'] } },
  {
    name: 'chorale phrase',
    chords: 'C F/C C G/B C/E F G7 C',
    key: 'C major',
    locals: ['C major', 'C major', 'C major', 'C major', 'C major', 'C major', 'C major', 'C major'],
    relations: { 6: ['authenticCadence'] },
  },
  { name: 'Andalusian cadence', chords: 'Am G F E', key: 'A minor', locals: ['A minor', 'A minor', 'A minor', 'A minor'], tags: { 3: ['halfCadence'] } },
  { name: 'Picardy third', chords: 'Am Dm E A', key: 'A minor', tags: { 3: ['picardyThird'] } },

  // Tonicization and substitution.
  {
    name: 'I–VI7–ii–V',
    home: 'C major',
    chords: 'Cmaj7 A7 Dm7 G7',
    locals: ['C major', 'D minor', 'C major', 'C major'],
    kinds: ['diatonic', 'secondaryDominant', 'diatonic', 'diatonic'],
    relations: { 1: ['secondaryResolution'] },
  },
  {
    name: 'iii–VI7–ii–V–I',
    chords: 'Em7 A7 Dm7 G7 Cmaj7',
    key: 'C major',
    locals: ['C major|D minor', 'D minor', 'C major', 'C major', 'C major'],
    relations: { 1: ['secondaryResolution'], 2: ['twoFive'], 3: ['authenticCadence'] },
    scales: ['E Phrygian|E Dorian', 'A Phrygian Dominant|A Mixolydian ♭6', 'D Dorian', 'G Mixolydian', 'C major'],
  },
  {
    name: 'extended dominants',
    chords: 'E7 A7 D7 G7 C',
    key: 'C major',
    locals: ['A minor', 'D minor', 'G major', 'C major', 'C major'],
    scales: ['E Phrygian Dominant|E Mixolydian ♭6', 'A Phrygian Dominant|A Mixolydian ♭6', 'D Mixolydian', 'G Mixolydian', 'C major'],
  },
  {
    name: 'rhythm changes bridge',
    home: 'B♭ major',
    chords: 'D7 G7 C7 F7 B♭',
    locals: ['G minor', 'C minor', 'F major', 'B♭ major', 'B♭ major'],
  },
  { name: 'rhythm changes A section', chords: 'B♭ G7 Cm7 F7 B♭', key: 'B♭ major', locals: ['B♭ major', 'C minor', 'B♭ major', 'B♭ major', 'B♭ major'] },
  {
    name: 'ii–V of iii resolving deceptively',
    home: 'C major',
    chords: 'Dm7 G7 F♯m7 B7 Cmaj7',
    locals: ['C major', 'C major', 'E minor|E major', 'E minor|E major', 'C major'],
    kinds: ['diatonic', 'diatonic', 'relatedTwo', 'secondaryDominant', 'diatonic'],
    relations: { 2: ['relatedTwoFive'], 3: ['deceptiveResolution'] },
  },
  {
    name: 'secondary leading-tone chord',
    chords: 'C C♯°7 Dm7 G7 C',
    key: 'C major',
    locals: ['C major', 'D minor', 'C major', 'C major', 'C major'],
    kinds: ['diatonic', 'secondaryLeadingTone', 'diatonic', 'diatonic', 'diatonic'],
    relations: { 1: ['leadingToneResolution'] },
    scales: ['C major', 'C♯ Whole-Half Diminished', 'D Dorian', 'G Mixolydian', 'C major'],
  },
  {
    name: 'tritone substitute',
    chords: 'Dm7 D♭7 Cmaj7',
    key: 'C major',
    kinds: ['diatonic', 'tritoneSub', 'diatonic'],
    relations: { 1: ['tritoneResolution'] },
    scales: ['D Dorian', 'D♭ Lydian Dominant', 'C major'],
  },
  {
    name: 'backdoor ii–V',
    chords: 'Fm7 B♭7 Cmaj7',
    key: 'C major',
    kinds: ['borrowed', 'borrowed', 'diatonic'],
    relations: { 0: ['backdoorTwoFive'], 1: ['backdoorCadence'] },
    tags: { 1: ['backdoorDominant'] },
    scales: ['F Dorian', 'B♭ Mixolydian', 'C major'],
  },
  {
    name: 'chromatic approach to V (the Find key bug report)',
    chords: 'F♯7(11) G7(13) Cm7(11)',
    key: 'C minor',
    locals: ['C minor', 'C minor', 'C minor'],
    kinds: ['chromaticApproach', 'diatonic', 'diatonic'],
    scales: ['F♯ Mixolydian', 'G Mixolydian ♭2', 'C minor'],
  },
  {
    name: 'Neapolitan ♭II',
    chords: 'C D♭/F G7 C',
    key: 'C major',
    tags: { 1: ['neapolitan'] },
    scales: ['C major', 'D♭ Lydian|D♭ major', 'G Mixolydian', 'C major'],
  },

  // Borrowing and colour.
  { name: 'borrowed ♭III', chords: 'C E♭ F C', key: 'C major', kinds: ['diatonic', 'borrowed', 'diatonic', 'diatonic'], relations: { 2: ['plagalCadence'] } },
  { name: 'minor plagal cadence', chords: 'C F Fm C', key: 'C major', kinds: ['diatonic', 'diatonic', 'borrowed', 'diatonic'], relations: { 2: ['minorPlagalCadence'] } },
  { name: 'blues', chords: 'A7 D7 A7 E7 D7 A7', key: 'A major', tags: { 1: ['bluesDominant'] } },
  { name: 'common-tone diminished', chords: 'C C°7 C', key: 'C major', kinds: ['diatonic', 'passingDiminished', 'diatonic'], relations: { 1: ['commonToneDiminished'] } },
  { name: 'chromatic mediants', home: 'C major', chords: 'C E C A♭ C', relations: { 0: ['chromaticMediant'], 2: ['chromaticMediant'] } },

  // Modes.
  { name: 'Dorian vamp', chords: 'Dm7 G7 Dm7 G7 Dm7', key: 'D Dorian' },
  {
    name: 'ii–V vamp ending on V: an implied I, Dorian or Mixolydian, all listed',
    chords: 'Dm7 G7 Dm7 G7',
    key: 'C major|D Dorian|G Mixolydian',
    lists: { 0: ['C major', 'D Dorian', 'G Mixolydian'] },
  },
  { name: 'C E C A♭ C', chords: 'C E C A♭ C', key: 'C major', kinds: ['diatonic', 'chromaticMediant', 'diatonic', 'borrowed', 'diatonic'] },
  { name: '♭VII–IV–I', chords: 'B♭ F C', key: 'C major|C Mixolydian' },
  { name: 'Mixolydian vamp', chords: 'G F C G', key: 'G Mixolydian|G major' },
  { name: 'Phrygian vamp', chords: 'Em F Em F Em', key: 'E Phrygian' },
  { name: 'Lydian vamp', chords: 'C D C D C', key: 'C Lydian' },

  // Modulation.
  {
    name: 'modulation from C to E',
    chords: 'Dm7 G7 Cmaj7 F♯m7 B7 Emaj7',
    key: 'C major',
    locals: ['C major', 'C major', 'C major', 'E major', 'E major', 'E major'],
    scales: ['D Dorian', 'G Mixolydian', 'C major', 'F♯ Dorian', 'B Mixolydian', 'E major'],
  },
  {
    name: 'modulation to the dominant, through chords both keys share',
    chords: 'C Dm G7 C Em Am D7 G Am D7 G',
    key: 'C major|G major',
    locals: ['C major', 'C major', 'C major', 'C major', '*', '*', 'G major', 'G major', 'G major', 'G major', 'G major'],
  },
  {
    name: 'Autumn Leaves, A section',
    chords: 'Cm7 F7 B♭maj7 E♭maj7 Am7♭5 D7 Gm',
    key: 'G minor|B♭ major',
    // Cm7 is both iv of G minor and the ii of F7's B♭; both readings are listed.
    locals: ['B♭ major|G minor', 'B♭ major', 'B♭ major|G minor', 'B♭ major|G minor', 'G minor', 'G minor', 'G minor'],
    lists: { 0: ['B♭ major', 'G minor'] },
    scales: ['C Dorian', 'F Mixolydian', 'B♭ major', 'E♭ Lydian', 'A Locrian', 'D Phrygian Dominant', 'G minor'],
  },
  {
    name: 'All the Things You Are, first eight bars',
    chords: 'Fm7 B♭m7 E♭7 A♭maj7 D♭maj7 G7 Cmaj7',
    key: 'A♭ major|C major',
    locals: ['A♭ major', 'A♭ major', 'A♭ major', 'A♭ major', 'A♭ major', 'C major', 'C major'],
  },
  {
    name: 'Giant Steps, first eight bars',
    chords: 'Bmaj7 D7 Gmaj7 B♭7 E♭maj7 Am7 D7 Gmaj7 B♭7 E♭maj7 F♯7 Bmaj7 Fm7 B♭7 E♭maj7',
    locals: [
      // Nothing yet says B is a tonic: Bmaj7 is ♭VI of the E♭ major the tune spends longest in.
      'B major|E♭ major',
      'G major',
      'G major',
      'E♭ major',
      'E♭ major',
      'G major',
      'G major',
      'G major',
      'E♭ major',
      'E♭ major',
      'B major',
      'B major',
      'E♭ major',
      'E♭ major',
      'E♭ major',
    ],
    patterns: [['coltraneChanges', 1, 14]],
  },

  // Patterns spanning several chords.
  { name: 'extended dominants, as a pattern', chords: 'E7 A7 D7 G7 C', key: 'C major', patterns: [['extendedDominants', 0, 4]] },
  { name: 'Andalusian cadence, as a pattern', chords: 'Am G F E', key: 'A minor', patterns: [['andalusian', 0, 3]] },
  { name: 'I–VI–ii–V turnaround', home: 'C major', chords: 'Cmaj7 A7 Dm7 G7', patterns: [['turnaround', 0, 3]] },
  { name: 'iii–VI–ii–V turnaround', home: 'C major', chords: 'Em7 A7 Dm7 G7', patterns: [['thirdTurnaround', 0, 3]] },
  { name: 'Tadd Dameron turnaround', home: 'C major', chords: 'Cmaj7 E♭maj7 A♭maj7 D♭maj7 Cmaj7', patterns: [['taddDameron', 0, 3]] },
  { name: 'turnaround in tritone substitutes', home: 'C major', chords: 'C E♭7 A♭7 D♭7 C', patterns: [['tritoneTurnaround', 0, 3]] },
  { name: 'chain of ii–Vs', chords: 'Em7 A7 E♭m7 A♭7 Dm7', key: 'D minor|C major', patterns: [['twoFiveChain', 0, 3]] },
  // Am6's F♯ makes A Dorian as good a key as A minor.
  { name: 'line cliché', chords: 'Am Am(maj7) Am7 Am6', key: 'A minor|A Dorian', patterns: [['lineCliche', 0, 3]] },
  { name: 'tonic pedal', chords: 'C F/C C G7 C', key: 'C major', patterns: [['tonicPedal', 0, 2]] },
  { name: 'planing', home: 'C major', chords: 'Dm7 E♭m7 Em7', patterns: [['planing', 0, 2]] },
  { name: 'blues, as a pattern', chords: 'A7 D7 A7 E7 D7 A7', key: 'A major', patterns: [['blues', 0, 5]] },
  { name: 'Dorian vamp, as a pattern', chords: 'Dm7 G7 Dm7 G7 Dm7', key: 'D Dorian', patterns: [['modalVamp', 0, 4]] },
  { name: 'Pachelbel', chords: 'C G Am Em F C F G', key: 'C major', patterns: [['pachelbel', 0, 5]] },
  { name: 'circle of fifths', chords: 'Am Dm G C F B° E Am', key: 'A minor', patterns: [['circleProgression', 0, 7]] },
  { name: 'ascending 5–6', home: 'C major', chords: 'C Am/C Dm B°/D Em C/E F', patterns: [['ascendingFiveSix', 0, 5]] },
  { name: 'Monte', home: 'C major', chords: 'C7 F D7 G', patterns: [['monte', 0, 3]] },
  { name: 'Fonte', home: 'C major', chords: 'A7 Dm G7 C', patterns: [['fonte', 0, 3]] },
  { name: 'Prinner', home: 'C major', chords: 'F C/E G/D C', patterns: [['prinner', 0, 3]] },
];

interface Outcome {
  readonly problems: readonly string[];
  readonly locals: readonly [number, number];
  readonly scales: readonly [number, number];
  readonly lists: readonly [number, number];
}

function evaluate(fixture: Fixture): Outcome {
  const symbols = fixture.chords.trim().split(/\s+/);
  const chords = progression(fixture.chords);
  const found = fixture.home ? null : findKey(chords);
  const analysis = fixture.home
    ? analyzeHarmony(chords.map((chord) => ({ chord })), { home: keyRef(fixture.home) })
    : found?.analysis;
  if (!analysis) return { problems: ['found no key'], locals: [0, 1], scales: [0, 0], lists: [0, 0] };
  const problems: string[] = [];
  const at = (i: number) => `box ${i} (${symbols[i]})`;
  const count = { locals: [0, 0], scales: [0, 0], lists: [0, 0] };

  if (fixture.key && found && !accepts(fixture.key, keyName(found.key))) {
    problems.push(`key ${keyName(found.key)}, expected ${fixture.key}`);
  }
  fixture.locals?.forEach((spec, i) => {
    const got = keyName(analysis.boxes[i].reading.local.ref);
    count.locals[1]++;
    if (accepts(spec, got)) count.locals[0]++;
    else problems.push(`${at(i)} local key ${got}, expected ${spec}`);
  });
  fixture.kinds?.forEach((kind, i) => {
    const got = analysis.boxes[i].reading.kind;
    if (kind !== '*' && got !== kind) problems.push(`${at(i)} reading ${got}, expected ${kind}`);
  });
  for (const [box, keys] of Object.entries(fixture.lists ?? {})) {
    const i = Number(box);
    const listed = [analysis.boxes[i].reading, ...analysis.boxes[i].alternatives].map((r) => keyName(r.local.ref));
    count.lists[1]++;
    const missing = keys.filter((k) => !listed.includes(k));
    if (missing.length === 0) count.lists[0]++;
    else problems.push(`${at(i)} lists ${listed.join(', ')}; missing ${missing.join(', ')}`);
  }
  for (const [box, ids] of Object.entries(fixture.relations ?? {})) {
    const i = Number(box);
    const got = analysis.relations[i].map((r) => r.id);
    const missing = ids.filter((id) => !got.includes(id));
    if (missing.length > 0) problems.push(`${at(i)} → next: relations ${got.join(', ') || 'none'}; missing ${missing.join(', ')}`);
  }
  for (const [box, tags] of Object.entries(fixture.tags ?? {})) {
    const i = Number(box);
    const missing = tags.filter((tag) => !analysis.boxes[i].tags.includes(tag));
    if (missing.length > 0) problems.push(`${at(i)} tags ${analysis.boxes[i].tags.join(', ') || 'none'}; missing ${missing.join(', ')}`);
  }
  fixture.scales?.forEach((spec, i) => {
    const got = scaleRefName(functionScale(chords[i].pcs, chords[i].chord, analysis.boxes[i]));
    count.scales[1]++;
    if (accepts(spec, got)) count.scales[0]++;
    else problems.push(`${at(i)} scale ${got}, expected ${spec}`);
  });
  for (const [id, first, last] of fixture.patterns ?? []) {
    if (!analysis.patterns.some((p) => p.id === id && p.first === first && p.last === last)) {
      const found = analysis.patterns.map((p) => `${p.id} ${p.first}–${p.last}`).join(', ') || 'none';
      problems.push(`pattern ${id} ${first}–${last} not found; found ${found}`);
    }
  }
  return {
    problems,
    locals: count.locals as [number, number],
    scales: count.scales as [number, number],
    lists: count.lists as [number, number],
  };
}

describe('harmonic analysis of labelled progressions', () => {
  it.each(FIXTURES.map((fixture) => [fixture.name, fixture] as const))('%s', (_, fixture) => {
    expect(evaluate(fixture).problems).toEqual([]);
  });

  it('reports agreement across the fixtures', () => {
    const outcomes = FIXTURES.map(evaluate);
    const share = (pick: (o: Outcome) => readonly [number, number]) => {
      const [hit, total] = outcomes.reduce(([h, t], o) => [h + pick(o)[0], t + pick(o)[1]], [0, 0]);
      return `${hit}/${total}`;
    };
    const report = {
      fixtures: `${outcomes.filter((o) => o.problems.length === 0).length}/${outcomes.length}`,
      localKeys: share((o) => o.locals),
      chordScales: share((o) => o.scales),
      ambiguousListings: share((o) => o.lists),
    };
    const perfect = Object.values(report).every((value) => {
      const [hit, total] = value.split('/').map(Number);
      return hit === total;
    });
    expect(perfect, JSON.stringify(report)).toBe(true);
  });
});
