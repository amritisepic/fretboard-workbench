/**
 * Named patterns spanning several chords (docs/harmonic-patterns.md): chains of dominants and ii–Vs,
 * turnarounds, cadence formulas, sequences and schemata, pedals, line clichés, planing, the blues,
 * modal vamps and key cycles. They are found in a finished analysis and only label it; the choice of
 * keys and readings doesn't depend on them.
 */

import type { FunctionQuality, PatternId } from '../data/harmonyRules';
import type { BoxAnalysis, ChordFacts, HarmonicAnalysis } from './analysis';
import { hasPc, mod12, pcsOf, type PitchClass } from './pitch';

export interface PatternSpan {
  readonly id: PatternId;
  /** First and last box index, inclusive. */
  readonly first: number;
  readonly last: number;
}

type Boxes = readonly BoxAnalysis[];

const DOMINANT: readonly FunctionQuality[] = ['dominant', 'suspendedDominant'];
const MAJOR_TYPE: readonly FunctionQuality[] = ['major', 'dominant'];

const factsAt = (boxes: Boxes, i: number): ChordFacts | null => (i >= 0 && i < boxes.length ? boxes[i].facts : null);

/** The root of box i in semitones above the home key's tonic at `home`, or null without a chord. */
function degreeAt(boxes: Boxes, i: number, home: number): number | null {
  const facts = factsAt(boxes, i);
  return facts ? mod12(facts.root - boxes[home].reading.home.tonic) : null;
}

interface Step {
  readonly degree: number;
  readonly qualities: readonly FunctionQuality[];
}

/** Boxes `start…` match `steps` in the home key of `start`, all in that home key. */
function matchesSteps(boxes: Boxes, start: number, steps: readonly Step[]): boolean {
  if (start + steps.length > boxes.length) return false;
  const home = boxes[start].reading.home;
  return steps.every((step, k) => {
    const facts = factsAt(boxes, start + k);
    return (
      facts !== null &&
      boxes[start + k].reading.home === home &&
      mod12(facts.root - home.tonic) === step.degree &&
      step.qualities.includes(facts.quality)
    );
  });
}

function findSteps(boxes: Boxes, id: PatternId, modes: readonly string[], steps: readonly Step[], out: PatternSpan[]) {
  for (let i = 0; i + steps.length <= boxes.length; i++) {
    if (modes.includes(boxes[i].reading.home.mode) && matchesSteps(boxes, i, steps)) {
      out.push({ id, first: i, last: i + steps.length - 1 });
    }
  }
}

/** Maximal runs of boxes where `joins(i)` holds between box i and box i + 1; returns [first, last] pairs. */
function runs(boxes: Boxes, joins: (i: number) => boolean): [number, number][] {
  const out: [number, number][] = [];
  let first = 0;
  for (let i = 0; i < boxes.length; i++) {
    if (i + 1 < boxes.length && joins(i)) continue;
    if (i > first) out.push([first, i]);
    first = i + 1;
  }
  return out;
}

const fifthDown = (a: ChordFacts | null, b: ChordFacts | null) => a !== null && b !== null && mod12(b.root - a.root) === 5;

function extendedDominants(boxes: Boxes, out: PatternSpan[]) {
  // Three or more dominants, each resolving a 5th down to the next; the chord they land on joins the span.
  for (const [first, last] of runs(boxes, (i) => {
    const a = factsAt(boxes, i);
    return a !== null && DOMINANT.includes(a.quality) && fifthDown(a, factsAt(boxes, i + 1));
  })) {
    const dominants = last - first;
    if (dominants >= 3) out.push({ id: 'extendedDominants', first, last });
  }
}

function circleProgression(boxes: Boxes, out: PatternSpan[]) {
  // Five or more roots falling by 5ths, not all dominants. A diatonic circle has one diminished 5th
  // (IV–vii°), so a run may take one.
  const step = (i: number) => {
    const a = factsAt(boxes, i);
    const b = factsAt(boxes, i + 1);
    return a !== null && b !== null ? mod12(b.root - a.root) : -1;
  };
  for (const [first, last] of runs(boxes, (i) => {
    if (step(i) === 5) return true;
    if (step(i) !== 6) return false;
    // Only one diminished 5th between this one and the previous run break.
    for (let k = i - 1; k >= 0 && (step(k) === 5 || step(k) === 6); k--) if (step(k) === 6) return false;
    return true;
  })) {
    if (last - first < 4) continue;
    const dominants = boxes.slice(first, last).filter((b) => b.facts && DOMINANT.includes(b.facts.quality)).length;
    if (dominants < last - first) out.push({ id: 'circleProgression', first, last });
  }
}

function twoFiveChain(boxes: Boxes, analysis: HarmonicAnalysis, out: PatternSpan[]) {
  const pairAt = (i: number) =>
    i < analysis.relations.length && analysis.relations[i].some((r) => r.id === 'twoFive' || r.id === 'relatedTwoFive');
  let i = 0;
  while (i < boxes.length) {
    if (!pairAt(i)) {
      i++;
      continue;
    }
    let end = i;
    const roots = new Set<PitchClass>([factsAt(boxes, i)?.root ?? -1]);
    while (pairAt(end + 2)) {
      end += 2;
      roots.add(factsAt(boxes, end)?.root ?? -1);
    }
    if (end > i && roots.size > 1) out.push({ id: 'twoFiveChain', first: i, last: end + 1 });
    i = end + 2;
  }
}

function turnarounds(boxes: Boxes, out: PatternSpan[]) {
  const two: Step = { degree: 2, qualities: ['minor', 'dominant'] };
  const five: Step = { degree: 7, qualities: DOMINANT.concat('major') };
  const six: Step = { degree: 9, qualities: ['minor', 'dominant'] };
  findSteps(boxes, 'turnaround', ['major'], [{ degree: 0, qualities: ['major'] }, six, two, five], out);
  findSteps(boxes, 'thirdTurnaround', ['major'], [{ degree: 4, qualities: ['minor', 'dominant'] }, six, two, five], out);
  findSteps(
    boxes,
    'taddDameron',
    ['major'],
    [
      { degree: 0, qualities: ['major'] },
      { degree: 3, qualities: ['major'] },
      { degree: 8, qualities: ['major'] },
      { degree: 1, qualities: MAJOR_TYPE },
    ],
    out,
  );
  findSteps(
    boxes,
    'tritoneTurnaround',
    ['major'],
    [
      { degree: 0, qualities: ['major'] },
      { degree: 3, qualities: ['dominant'] },
      { degree: 8, qualities: ['dominant'] },
      { degree: 1, qualities: ['dominant'] },
    ],
    out,
  );
}

function cadenceFormulas(boxes: Boxes, out: PatternSpan[]) {
  findSteps(
    boxes,
    'andalusian',
    ['minor', 'phrygian'],
    [
      { degree: 0, qualities: ['minor'] },
      { degree: 10, qualities: ['major'] },
      { degree: 8, qualities: ['major'] },
      { degree: 7, qualities: ['major', 'dominant'] },
    ],
    out,
  );
  findSteps(
    boxes,
    'mixolydianCadence',
    ['major', 'mixolydian'],
    [
      { degree: 10, qualities: ['major'] },
      { degree: 5, qualities: ['major'] },
      { degree: 0, qualities: ['major'] },
    ],
    out,
  );
  const pachelbel: Step[] = [
    { degree: 0, qualities: ['major'] },
    { degree: 7, qualities: ['major'] },
    { degree: 9, qualities: ['minor'] },
    { degree: 4, qualities: ['minor', 'major'] },
    { degree: 5, qualities: ['major'] },
    { degree: 0, qualities: ['major'] },
  ];
  findSteps(boxes, 'pachelbel', ['major'], pachelbel, out);
}

function schemata(boxes: Boxes, out: PatternSpan[]) {
  // A secondary dominant resolving to its target, then another a step away: Monte rises, Fonte falls.
  const resolvedTarget = (i: number) => {
    const a = factsAt(boxes, i);
    const b = factsAt(boxes, i + 1);
    return a !== null && b !== null && DOMINANT.includes(a.quality) && fifthDown(a, b) ? b : null;
  };
  for (let i = 0; i + 3 < boxes.length; i++) {
    const first = resolvedTarget(i);
    const second = resolvedTarget(i + 2);
    if (!first || !second) continue;
    const step = mod12(second.root - first.root);
    if (step === 2) out.push({ id: 'monte', first: i, last: i + 3 });
    if (step === 10 && first.quality === 'minor' && MAJOR_TYPE.includes(second.quality)) out.push({ id: 'fonte', first: i, last: i + 3 });
  }
  // Prinner: the bass falls 6–5–4–3 in the key (4–3–2–1 of the major scale).
  for (let i = 0; i + 3 < boxes.length; i++) {
    const home = boxes[i].reading.home;
    const basses = [0, 1, 2, 3].map((k) => {
      const facts = factsAt(boxes, i + k);
      return facts && facts.bass !== null && boxes[i + k].reading.home === home ? mod12(facts.bass - home.tonic) : null;
    });
    const line = home.mode === 'minor' ? [8, 7, 5, 3] : [5, 4, 2, 0];
    if (home.mode !== 'minor' && home.mode !== 'major') continue;
    if (basses.every((bass, k) => bass === line[k])) out.push({ id: 'prinner', first: i, last: i + 3 });
  }
  // Ascending 5–6: a chord, then the chord a 3rd below over the same bass (its 5th rising to a 6th),
  // then up a step, at least twice.
  let start = -1;
  let i = 0;
  for (; i + 1 < boxes.length; i += 2) {
    const a = factsAt(boxes, i);
    const b = factsAt(boxes, i + 1);
    const c = factsAt(boxes, i + 2);
    const pair =
      a !== null && b !== null && a.bass !== null && a.bass === b.bass && [3, 4].includes(mod12(a.bass - b.root));
    if (!pair) {
      // The pairs so far end at the box before this one.
      if (start !== -1 && i - start >= 4) out.push({ id: 'ascendingFiveSix', first: start, last: i - 1 });
      start = -1;
      continue;
    }
    if (start === -1) start = i;
    const rises = c !== null && c.bass !== null && a.bass !== null && [1, 2].includes(mod12(c.bass - a.bass));
    if (!rises) {
      if (i - start >= 2) out.push({ id: 'ascendingFiveSix', first: start, last: i + 1 });
      start = -1;
    }
  }
  if (start !== -1 && i - start >= 4) out.push({ id: 'ascendingFiveSix', first: start, last: i - 1 });
}

function pedals(boxes: Boxes, out: PatternSpan[]) {
  for (const [first, last] of runs(boxes, (i) => {
    const a = factsAt(boxes, i);
    const b = factsAt(boxes, i + 1);
    return a !== null && b !== null && a.bass !== null && a.bass === b.bass;
  })) {
    if (last - first < 2) continue;
    const roots = new Set(boxes.slice(first, last + 1).map((b) => b.facts?.root));
    if (roots.size < 2) continue;
    const bass = factsAt(boxes, first)?.bass ?? 0;
    const degree = mod12(bass - boxes[first].reading.home.tonic);
    out.push({ id: degree === 0 ? 'tonicPedal' : degree === 7 ? 'dominantPedal' : 'pedalPoint', first, last });
  }
}

/** The tone that moves in a line cliché: whatever isn't root, minor or major 3rd, or perfect 5th. */
function lineTones(facts: ChordFacts): PitchClass[] {
  const core = [0, 3, 4, 7].map((iv) => mod12(facts.root + iv));
  const extra = pcsOf(facts.pcs).filter((pc) => !core.includes(pc) || (pc === mod12(facts.root + 7) && !hasPc(facts.pcs, facts.root + 4) && !hasPc(facts.pcs, facts.root + 3)));
  if (extra.length === 1) return extra;
  if (extra.length === 0) return [facts.root, mod12(facts.root + 7)].filter((pc) => hasPc(facts.pcs, pc));
  return [];
}

function lineCliches(boxes: Boxes, out: PatternSpan[]) {
  const thirdOf = (f: ChordFacts) => (hasPc(f.pcs, f.root + 3) ? 3 : hasPc(f.pcs, f.root + 4) ? 4 : 0);
  for (const [first, last] of runs(boxes, (i) => {
    const a = factsAt(boxes, i);
    const b = factsAt(boxes, i + 1);
    return a !== null && b !== null && a.root === b.root && thirdOf(a) === thirdOf(b) && thirdOf(a) !== 0 && a.pcs !== b.pcs;
  })) {
    if (last - first < 2) continue;
    // Some choice of moving tone per chord must step by a half step, always the same way.
    for (const direction of [1, 11]) {
      let lines = lineTones(boxes[first].facts as ChordFacts);
      for (let i = first + 1; i <= last && lines.length > 0; i++) {
        const next = lineTones(boxes[i].facts as ChordFacts);
        lines = next.filter((pc) => lines.some((prev) => mod12(pc - prev) === direction));
      }
      if (lines.length > 0) {
        out.push({ id: 'lineCliche', first, last });
        break;
      }
    }
  }
}

function planing(boxes: Boxes, out: PatternSpan[]) {
  for (const [first, last] of runs(boxes, (i) => {
    const a = factsAt(boxes, i);
    const b = factsAt(boxes, i + 1);
    const c = factsAt(boxes, i - 1);
    if (a === null || b === null || a.chord.type.id !== b.chord.type.id) return false;
    const step = mod12(b.root - a.root);
    if (![1, 2, 10, 11].includes(step)) return false;
    // The same motion as the step before, when that step is part of the run.
    return c === null || c.chord.type.id !== a.chord.type.id || mod12(a.root - c.root) === step;
  })) {
    if (last - first >= 2) out.push({ id: 'planing', first, last });
  }
}

function blues(boxes: Boxes, out: PatternSpan[]) {
  for (const [first, last] of runs(boxes, (i) => {
    const home = boxes[i].reading.home;
    const bluesChord = (k: number) => {
      const facts = factsAt(boxes, k);
      return (
        facts !== null &&
        boxes[k].reading.home === home &&
        home.mode === 'major' &&
        facts.quality === 'dominant' &&
        [0, 5, 7].includes(mod12(facts.root - home.tonic))
      );
    };
    return bluesChord(i) && bluesChord(i + 1);
  })) {
    const degrees = new Set(boxes.slice(first, last + 1).map((_, k) => degreeAt(boxes, first + k, first)));
    if (last - first >= 2 && degrees.has(0) && degrees.has(5)) out.push({ id: 'blues', first, last });
  }
}

function modalVamps(boxes: Boxes, out: PatternSpan[]) {
  for (const [first, last] of runs(boxes, (i) => {
    const a = factsAt(boxes, i);
    const b = factsAt(boxes, i + 1);
    const c = factsAt(boxes, i + 2);
    const home = boxes[i].reading.home;
    return (
      a !== null &&
      b !== null &&
      a.root !== b.root &&
      home.mode !== 'major' &&
      home.mode !== 'minor' &&
      boxes[i + 1].reading.home === home &&
      (c === null || i + 2 >= boxes.length || c.root === a.root)
    );
  })) {
    const tonic = boxes[first].reading.home.tonic;
    const roots = boxes.slice(first, last + 1).map((b) => b.facts?.root);
    if (last - first >= 3 && roots.includes(tonic)) out.push({ id: 'modalVamp', first, last });
  }
}

function coltraneChanges(boxes: Boxes, out: PatternSpan[]) {
  // Arrivals on a major tonic by V–I, whose tonics move by major 3rds.
  const arrivals: { readonly index: number; readonly tonic: PitchClass }[] = [];
  boxes.forEach((box, i) => {
    const facts = box.facts;
    const previous = factsAt(boxes, i - 1);
    if (facts && previous && facts.quality === 'major' && DOMINANT.includes(previous.quality) && fifthDown(previous, facts)) {
      arrivals.push({ index: i, tonic: facts.root });
    }
  });
  let start = 0;
  for (let k = 1; k <= arrivals.length; k++) {
    const thirds = k < arrivals.length && [4, 8].includes(mod12(arrivals[k].tonic - arrivals[k - 1].tonic));
    if (thirds) continue;
    const group = arrivals.slice(start, k);
    if (new Set(group.map((a) => a.tonic)).size >= 3) {
      out.push({ id: 'coltraneChanges', first: group[0].index - 1, last: group[group.length - 1].index });
    }
    start = k;
  }
}

/** Every named pattern in an analysis, in order of first box. */
export function findPatterns(analysis: HarmonicAnalysis): PatternSpan[] {
  const boxes = analysis.boxes;
  const out: PatternSpan[] = [];
  extendedDominants(boxes, out);
  circleProgression(boxes, out);
  twoFiveChain(boxes, analysis, out);
  turnarounds(boxes, out);
  cadenceFormulas(boxes, out);
  schemata(boxes, out);
  pedals(boxes, out);
  lineCliches(boxes, out);
  planing(boxes, out);
  blues(boxes, out);
  modalVamps(boxes, out);
  coltraneChanges(boxes, out);
  return out.sort((a, b) => a.first - b.first || b.last - a.last);
}
