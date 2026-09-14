/**
 * Harmonic analysis as the canvas shows it (docs/harmonic-analysis-plan.md §3.5): each chord's
 * function in jazz or classical notation, a one-sentence explanation, the relations and patterns in
 * the strips, and the readings an ambiguous chord could have.
 */

import { PATTERN_NAMES, type CadenceId } from '../data/harmonyRules';
import type { HarmonyNotation } from '../state/workbench';
import {
  chordSpellingHint,
  degreeNumeral,
  formatSpelled,
  homeKeyAt,
  keyName,
  mod12,
  readingTarget,
  scaleRefContext,
  spellPc,
  type BoxAnalysis,
  type ChordFacts,
  type FunctionQuality,
  type ModulationKind,
  type NumeralQuality,
  type PatternSpan,
  type Reading,
  type Relation,
  type RelationId,
} from '../theory';

// ---------------------------------------------------------------------------
// Function labels
// ---------------------------------------------------------------------------

export interface FunctionLabel {
  /** The numeral with its quality sign: "V", "vii°", "♭VI", "subV". */
  readonly numeral: string;
  /** Jazz chord-type suffix ("7", "maj7", "6"); empty in classical notation. */
  readonly suffix: string;
  /** Classical figured bass, top figure first ("6", "5"); empty in jazz notation. */
  readonly figures: readonly string[];
  /** "/IV" for a chord pointing at another, or "". */
  readonly target: string;
  /** A short note: "borrowed from C minor", "tonicized", "passing". */
  readonly note: string;
  /** The label as plain text, figures as superscripts: "V⁶₅/V", "V7/IV". */
  readonly text: string;
}

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUBSCRIPT = '₀₁₂₃₄₅₆₇₈₉';

/** "7" → "⁷", ["6", "5"] → "⁶₅". */
export function figuresText(figures: readonly string[]): string {
  const digits = (text: string, set: string) => [...text].map((d) => set[Number(d)] ?? d).join('');
  if (figures.length === 0) return '';
  if (figures.length === 1) return digits(figures[0], SUPERSCRIPT);
  return digits(figures[0], SUPERSCRIPT) + figures.slice(1).map((f) => digits(f, SUBSCRIPT)).join('');
}

function numeralQuality(quality: FunctionQuality): NumeralQuality {
  switch (quality) {
    case 'minor':
      return 'minor';
    case 'diminished':
    case 'diminished7':
      return 'diminished';
    case 'halfDiminished':
      return 'halfDiminished';
    case 'augmented':
      return 'augmented';
    default:
      return 'major';
  }
}

function jazzSuffix(facts: ChordFacts): string {
  if (facts.quality === 'suspendedDominant') return '7sus';
  if (facts.quality === 'suspended') return 'sus';
  switch (facts.shape) {
    case 'seventh':
      return '7';
    case 'majorSeventh':
      return 'maj7';
    case 'sixth':
      return '6';
    default:
      return '';
  }
}

/** Figured bass for the chord with `root` as its root: the bass decides the inversion. */
function figuredBass(facts: ChordFacts, root: number): string[] {
  const seventh = facts.shape === 'seventh' || facts.shape === 'majorSeventh';
  let inversion = facts.inversion;
  if (root !== facts.root && facts.bass !== null) {
    const above = mod12(facts.bass - root);
    inversion = above === 0 ? 0 : above <= 4 ? 1 : above <= 8 ? 2 : 3;
  }
  switch (inversion) {
    case 1:
      return seventh ? ['6', '5'] : ['6'];
    case 2:
      return seventh ? ['4', '3'] : ['6', '4'];
    case 3:
      return seventh ? ['4', '2'] : [];
    default:
      return seventh ? ['7'] : [];
  }
}

/**
 * A dominant-7th shape a half step above V is, in classical terms, an augmented sixth chord on ♭6:
 * Ger⁶₅ (A♭ C E♭ F♯ in C), Fr⁴₃ with a ♭5 (A♭ C D F♯), It⁶ without its 5th (A♭ C F♯).
 */
function augmentedSixthName(facts: ChordFacts): { readonly name: string; readonly figures: readonly string[] } | null {
  const { type, omitted } = facts.chord;
  if (type.id === '7b5') return { name: 'Fr', figures: ['4', '3'] };
  if (type.id !== '7') return null;
  return omitted.includes('5') ? { name: 'It', figures: ['6'] } : { name: 'Ger', figures: ['6', '5'] };
}

const TAG_NOTES: Readonly<Record<string, string>> = {
  neapolitan: 'Neapolitan',
  backdoorDominant: 'backdoor',
  picardyThird: 'Picardy third',
  bluesDominant: 'blues',
  halfCadence: 'half cadence',
};

/** The name of the key a borrowed reading comes from. */
const sourceKeyName = (reading: Reading) =>
  reading.source === null ? '' : keyName(homeKeyAt(reading.home.tonic, reading.source).ref);

/**
 * A chord's function in its home key. A secondary chord is named from its target (V7/IV, vii°7/ii,
 * ii/V); a tritone substitute is subV7 in jazz and ♭II⁷ in classical notation. `withTags` adds the
 * box's own notes (Neapolitan, backdoor, Picardy third), which belong to its chosen reading.
 */
export function functionLabel(
  box: BoxAnalysis,
  reading: Reading,
  notation: HarmonyNotation,
  withTags = reading === box.reading,
): FunctionLabel {
  const facts = box.facts;
  if (!facts || reading.kind === 'none') {
    return { numeral: '', suffix: '', figures: [], target: '', note: '', text: '' };
  }
  const jazz = notation === 'jazz';
  const home = reading.home.ref;
  const hint = reading.root === facts.root ? chordSpellingHint(facts.chord) : undefined;
  const target = readingTarget(reading);
  const targetNumeral =
    target === null || target === reading.home.tonic
      ? ''
      : `/${degreeNumeral(target, home, reading.local.mode === 'minor' ? 'minor' : 'major')}`;

  let numeral: string;
  switch (reading.kind) {
    case 'secondaryDominant':
      numeral = facts.quality === 'augmented' ? 'V+' : 'V';
      break;
    case 'secondaryLeadingTone':
      numeral = facts.quality === 'halfDiminished' ? 'viiø' : 'vii°';
      break;
    case 'relatedTwo':
      numeral = facts.quality === 'halfDiminished' ? 'iiø' : 'ii';
      break;
    case 'tritoneSub':
      numeral = jazz ? 'subV' : '♭II';
      break;
    default:
      numeral = degreeNumeral(reading.root, home, numeralQuality(facts.quality), hint);
  }

  const notes: string[] = [];
  if (withTags) for (const tag of box.tags) notes.push(TAG_NOTES[tag]);
  switch (reading.kind) {
    case 'borrowed':
      if (!box.tags.includes('bluesDominant') || !withTags) {
        notes.push(jazz ? `borrowed from ${sourceKeyName(reading)}` : `mixture (${sourceKeyName(reading)})`);
      }
      break;
    case 'chromatic':
      notes.push('chromatic');
      break;
    case 'tonicized':
      notes.push(`tonicized`);
      break;
    case 'chromaticApproach':
      notes.push(jazz ? 'approach' : 'chromatic approach');
      break;
    case 'chromaticMediant':
      notes.push('chromatic mediant');
      break;
    case 'passingDiminished':
      notes.push('passing');
      break;
    case 'tritoneSub':
      if (!jazz) notes.push('tritone sub');
      break;
    default:
      break;
  }

  // Classical notation names a tritone substitute of V by its augmented sixth: A♭7 → G in C is Ger⁶₅.
  const augmentedSixth =
    !jazz && reading.kind === 'tritoneSub' && target === mod12(reading.home.tonic + 7) ? augmentedSixthName(facts) : null;
  if (augmentedSixth) {
    const figures = facts.inversion === 0 ? augmentedSixth.figures : [];
    const note = [...notes.filter((n) => n !== 'tritone sub'), 'augmented sixth chord'].join(' · ');
    return { numeral: augmentedSixth.name, suffix: '', figures, target: '', note, text: augmentedSixth.name + figuresText(figures) };
  }

  const suffix = jazz ? jazzSuffix(facts) : '';
  const figures = jazz ? [] : figuredBass(facts, reading.root);
  const note = notes.join(' · ');
  // In classical notation a leading-tone seventh's quality sign already sits in the numeral.
  const text = numeral + suffix + figuresText(figures) + targetNumeral;
  return { numeral, suffix, figures, target: targetNumeral, note, text };
}

// ---------------------------------------------------------------------------
// Explanations
// ---------------------------------------------------------------------------

export interface ExplanationContext {
  /** The chord's name as its box shows it. */
  readonly title: string;
  readonly previousTitle: string | null;
  readonly nextTitle: string | null;
  /** The next box's chord root, when it has one. */
  readonly nextRoot: number | null;
  readonly notation: HarmonyNotation;
}

/** The target chord's name, spelled in the home key like its numeral: "D♭", "B♭m" (D♭m in A♭, not C♯m). */
function targetName(reading: Reading): string {
  const target = readingTarget(reading);
  if (target === null) return '';
  const spelled = formatSpelled(spellPc(target, scaleRefContext(reading.home.ref)));
  return spelled + (reading.local.mode === 'minor' ? 'm' : '');
}

/** One sentence saying what a reading means, as shown on hover or tap and in the sidebar. */
export function explainReading(box: BoxAnalysis, reading: Reading, context: ExplanationContext): string {
  const facts = box.facts;
  if (!facts || reading.kind === 'none') return '';
  const label = functionLabel(box, reading, context.notation);
  const { title, nextTitle, previousTitle } = context;
  const home = keyName(reading.home.ref);
  const local = keyName(reading.local.ref);
  const target = targetName(reading);
  const resolves = context.nextRoot !== null && context.nextRoot === readingTarget(reading);
  const numeral = label.numeral + label.suffix + figuresText(label.figures);
  const implied = resolves ? '' : nextTitle === null ? ` ${target} is implied.` : ` It moves to ${nextTitle} instead.`;
  const tags = reading === box.reading ? box.tags : [];

  switch (reading.kind) {
    case 'diatonic':
      if (tags.includes('halfCadence')) return `${title} is ${numeral} in ${home}, ending on the dominant: a half cadence.`;
      return `${title} is ${numeral} in ${home}.`;
    case 'borrowed':
      if (tags.includes('bluesDominant')) return `${title} is ${numeral} of a blues in ${home}.`;
      if (tags.includes('neapolitan')) return `${title} is the Neapolitan ♭II in ${home}, borrowed from ${sourceKeyName(reading)}.`;
      if (tags.includes('backdoorDominant')) {
        return `${title} is the backdoor dominant ${numeral} in ${home}, borrowed from ${sourceKeyName(reading)}.`;
      }
      if (tags.includes('picardyThird')) return `${title} ends ${home} on a major tonic: a Picardy third.`;
      return `${title} is ${numeral} in ${home}, borrowed from ${sourceKeyName(reading)}.`;
    case 'chromatic':
      return `${title} is ${numeral}, outside ${home}.`;
    case 'secondaryDominant':
      return `${title} is V${label.suffix} of ${target}: it borrows the dominant of the ${label.target.slice(1)} chord, so the key bar shows ${local}.${implied}`;
    case 'secondaryLeadingTone':
      return `${title} is ${label.numeral}${label.suffix} of ${target}: its root is the leading tone of ${local}.${implied}`;
    case 'relatedTwo':
      return `${title} is the ii of ${target}, paired with its dominant ${nextTitle ?? ''} in ${local}.`;
    case 'tritoneSub':
      return reading.local === reading.home
        ? `${title} is a tritone substitute for the dominant of ${home}, a half step above its tonic.${resolves ? '' : implied}`
        : `${title} is a tritone substitute for the dominant of ${target}, a half step above it.${implied}`;
    case 'tonicized':
      return `${title} is ${numeral} in ${home}, heard for a moment as the tonic of ${local} after its dominant.`;
    case 'chromaticApproach': {
      const up = context.nextRoot !== null && mod12(context.nextRoot - facts.root) === 1;
      return `${title} slides a half step ${up ? 'up' : 'down'} into ${nextTitle ?? 'the next chord'}: a chromatic approach.`;
    }
    case 'chromaticMediant':
      return `${title} is a chromatic mediant in ${home}: a 3rd from its neighbour, with the same quality.`;
    case 'passingDiminished':
      return context.nextRoot !== null && (facts.pcs & (1 << context.nextRoot)) !== 0
        ? `${title} is a common-tone diminished chord, sharing a note with ${nextTitle ?? 'the next chord'}'s root.`
        : `${title} is a passing diminished chord between ${previousTitle ?? 'the chord before'} and ${nextTitle ?? 'the next chord'}.`;
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Relations and patterns in the strips
// ---------------------------------------------------------------------------

export interface RelationView {
  readonly id: RelationId;
  readonly label: string;
  /** Jazz notation draws an arrow for a resolution: dashed for a tritone substitute. */
  readonly arrow: 'solid' | 'dashed' | null;
  /** Jazz notation brackets a ii–V pair. */
  readonly bracket: boolean;
}

type Labels = { readonly jazz: string; readonly classical: string };
const both = (label: string): Labels => ({ jazz: label, classical: label });

const CADENCE_LABELS: Readonly<Record<CadenceId, Labels>> = {
  authenticCadence: { jazz: 'V–I', classical: 'authentic cadence' },
  leadingToneCadence: { jazz: 'vii°–I', classical: 'leading-tone cadence' },
  tritoneSubCadence: { jazz: 'subV–I', classical: '♭II–I' },
  backdoorCadence: { jazz: 'backdoor ♭VII7–I', classical: '♭VII⁷–I' },
  backdoorTwoFive: { jazz: 'backdoor ii–V', classical: 'iv–♭VII⁷' },
  twoFive: both('ii–V'),
  predominantToDominant: { jazz: 'to the dominant', classical: 'predominant–dominant' },
  phrygianHalfCadence: both('Phrygian half cadence'),
  cadential64: { jazz: 'I/5–V', classical: 'cadential ⁶₄' },
  deceptiveCadence: { jazz: 'deceptive', classical: 'deceptive cadence' },
  plagalCadence: { jazz: 'plagal', classical: 'plagal cadence' },
  minorPlagalCadence: { jazz: 'minor plagal', classical: 'minor plagal cadence' },
  modalCadence: both('modal cadence'),
  tonicDeparture: both(''),
  descendingFifth: both(''),
  retrogression: both(''),
};

const RELATION_LABELS: Readonly<Record<Exclude<RelationId, CadenceId | 'modulation'>, Labels>> = {
  secondaryResolution: both('resolves'),
  deceptiveResolution: { jazz: 'deceptive', classical: 'deceptive resolution' },
  leadingToneResolution: both('resolves'),
  tritoneResolution: { jazz: 'sub resolves', classical: 'tritone sub resolves' },
  relatedTwoFive: both('ii–V'),
  chromaticMediant: both('chromatic mediant'),
  commonToneDiminished: both('common tone'),
  passingDiminished: both('passing'),
  chromaticApproach: both('half-step approach'),
};

const MODULATION_WORDS: Readonly<Record<ModulationKind, string>> = {
  pivot: 'by a pivot chord',
  direct: 'directly',
  commonTone: 'by a common tone',
  enharmonic: 'enharmonically',
};

const SOLID: ReadonlySet<RelationId> = new Set(['secondaryResolution', 'leadingToneResolution', 'authenticCadence', 'leadingToneCadence', 'backdoorCadence']);
const DASHED: ReadonlySet<RelationId> = new Set(['tritoneResolution', 'tritoneSubCadence']);
const BRACKETED: ReadonlySet<RelationId> = new Set(['twoFive', 'relatedTwoFive', 'backdoorTwoFive']);

/** The relations between two boxes as the strip lane shows them, the modulation (if any) first. `toKey` names the key modulated to. */
export function relationViews(relations: readonly Relation[], notation: HarmonyNotation, toKey: string): RelationView[] {
  const jazz = notation === 'jazz';
  const views = relations.map((relation): RelationView => {
    const { id } = relation;
    let label: string;
    if (id === 'modulation') label = `to ${toKey} ${MODULATION_WORDS[relation.modulation ?? 'direct']}`;
    else if (id in RELATION_LABELS) label = RELATION_LABELS[id as keyof typeof RELATION_LABELS][notation];
    else label = CADENCE_LABELS[id as CadenceId][notation];
    return {
      id,
      label,
      arrow: jazz && SOLID.has(id) ? 'solid' : jazz && DASHED.has(id) ? 'dashed' : null,
      bracket: jazz && BRACKETED.has(id),
    };
  });
  // A resolution and the cadence it makes say the same thing twice: keep the more specific one.
  const hasSpecific = views.some((v) => v.id === 'secondaryResolution' || v.id === 'tritoneResolution');
  return views
    .filter((v) => v.label !== '' && !(hasSpecific && (v.id === 'authenticCadence' || v.id === 'tritoneSubCadence')))
    .filter((v) => !(v.id === 'twoFive' && views.some((o) => o.id === 'relatedTwoFive')))
    .sort((a, b) => Number(b.id === 'modulation') - Number(a.id === 'modulation'));
}

export interface PatternView {
  readonly name: string;
  /** The strip is the first one inside the pattern. */
  readonly starts: boolean;
}

/** What the analysis lane of one strip shows. */
export interface AnalysisLane {
  readonly relations: readonly RelationView[];
  readonly patterns: readonly PatternView[];
}

/** Patterns running across the strip between box `index - 1` and box `index`. */
export function patternsAcross(patterns: readonly PatternSpan[], index: number): PatternView[] {
  return patterns
    .filter((p) => p.first < index && p.last >= index)
    .map((p) => ({ name: PATTERN_NAMES[p.id], starts: p.first === index - 1 }));
}
