// Offline evaluation of the harmonic analysis against research corpora (docs/harmonic-analysis-plan.md §3.6).
//
//   npm run eval:corpus
//
// Reads the corpora in corpora/ (downloaded separately; see corpora/SOURCES.md, never committed) and
// writes a report to corpora/reports/. Environment variables:
//   CORPUS_DIR     where the corpora are (default "corpora")
//   CORPUS_WINDOW  chords per analysed window (default 0, whole pieces). A window cut mid-phrase
//                  ends on an arbitrary chord, which the analysis takes as evidence for the tonic,
//                  so windows understate it; they are there to test workbench-sized progressions.
//   CORPUS_LIMIT   at most this many pieces per corpus, for quick runs
//   CORPUS_ONLY    a comma-separated list of corpora to run (billboard, rs200, when-in-rome)

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { it } from 'vitest';
import { parseBillboard } from '../../src/corpus/billboard';
import { parseRockAnalysis } from '../../src/corpus/rockCorpus';
import { parseRomanText } from '../../src/corpus/romanText';
import type { CorpusChord, CorpusKey, CorpusPiece } from '../../src/corpus/types';
import { findKey, homeKeyOf, mod12, type HomeKey } from '../../src/theory';
import { findKey as legacyFindKey } from './legacy/keys';

const ROOT = process.env.CORPUS_DIR ?? 'corpora';
const WINDOW = Number(process.env.CORPUS_WINDOW ?? 0);
const LIMIT = Number(process.env.CORPUS_LIMIT ?? Number.POSITIVE_INFINITY);
const ONLY = process.env.CORPUS_ONLY?.split(',').map((s) => s.trim());
const MIN_WINDOW = 4;
/** Chords shown per example of a badly read piece. */
const EXAMPLE_CHORDS = 24;

const PC_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
/** "E♭" for a major key, "Cm" for a minor one, "E♭?" for a tonic without a mode. */
const keyText = (key: { readonly tonic: number; readonly mode: 'major' | 'minor' | null }) =>
  `${PC_NAMES[key.tonic]}${key.mode === 'minor' ? 'm' : key.mode === null ? '?' : ''}`;

interface SimpleKey {
  readonly tonic: number;
  readonly mode: 'major' | 'minor';
}

const simple = (key: HomeKey): SimpleKey => ({ tonic: key.tonic, mode: key.majorThird ? 'major' : 'minor' });

function walk(dir: string, match: (path: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path, match));
    else if (match(path)) out.push(path);
  }
  return out.sort();
}

interface Source {
  readonly corpus: string;
  readonly load: () => { readonly group: string; readonly piece: CorpusPiece }[];
}

const SOURCES: readonly Source[] = [
  {
    corpus: 'billboard',
    load: () =>
      walk(join(ROOT, 'billboard'), (p) => basename(p) === 'salami_chords.txt').map((path) => ({
        group: 'all',
        piece: parseBillboard(readFileSync(path, 'utf8'), basename(join(path, '..'))),
      })),
  },
  {
    corpus: 'rs200',
    load: () =>
      walk(join(ROOT, 'rs200'), (p) => p.endsWith('.har') && !p.includes('__MACOSX')).map((path) => {
        const analyst = /_(dt|tdc)\.har$/.exec(path)?.[1] ?? 'unknown';
        return { group: analyst, piece: parseRockAnalysis(readFileSync(path, 'utf8'), basename(path), analyst) };
      }),
  },
  {
    corpus: 'when-in-rome',
    load: () => {
      const corpusDir = join(ROOT, 'when-in-rome', 'Corpus');
      return walk(corpusDir, (p) => /analysis[^/\\]*\.txt$/.test(p)).map((path) => {
        const group = relative(corpusDir, path).split(sep)[0];
        const analyst = /analysis_?([^/\\]*)\.txt$/.exec(path)?.[1] || 'main';
        return { group, piece: parseRomanText(readFileSync(path, 'utf8'), relative(corpusDir, path), analyst) };
      });
    },
  },
];

interface Tally {
  pieces: number;
  windows: number;
  chords: number;
  tonicV2: number;
  tonicLegacy: number;
  tonicBaseline: number;
  /** Chords whose annotation gives a mode. */
  keyed: number;
  keyV2: number;
  keyLegacy: number;
  /** Applied chords (V/x) and whether the key bar shows the target's key there. */
  applied: number;
  appliedV2: number;
  appliedLegacy: number;
  /** Chords where v2's reading is wrong, and where the annotated key is among its alternatives. */
  wrongV2: number;
  wrongListed: number;
  ambiguous: number;
  windowTonicV2: number;
  windowTonicLegacy: number;
  errors: Record<string, number>;
  ms: number;
}

const emptyTally = (): Tally => ({
  pieces: 0,
  windows: 0,
  chords: 0,
  tonicV2: 0,
  tonicLegacy: 0,
  tonicBaseline: 0,
  keyed: 0,
  keyV2: 0,
  keyLegacy: 0,
  applied: 0,
  appliedV2: 0,
  appliedLegacy: 0,
  wrongV2: 0,
  wrongListed: 0,
  ambiguous: 0,
  windowTonicV2: 0,
  windowTonicLegacy: 0,
  errors: {},
  ms: 0,
});

/** How a wrong key relates to the annotated one. */
function relation(annotated: CorpusKey, got: SimpleKey): string {
  const up = mod12(got.tonic - annotated.tonic);
  if (up === 0) return 'parallel';
  if ((annotated.mode === 'major' && got.mode === 'minor' && up === 9) || (annotated.mode === 'minor' && got.mode === 'major' && up === 3)) {
    return 'relative';
  }
  if (annotated.mode === null && (up === 9 || up === 3)) return 'relative (tonic a 3rd away)';
  if (up === 7) return 'a 5th above';
  if (up === 5) return 'a 5th below';
  return 'other';
}

const matches = (annotated: CorpusKey, got: SimpleKey) =>
  annotated.tonic === got.tonic && (annotated.mode === null || annotated.mode === got.mode);

function mostCommonTonic(chords: readonly CorpusChord[], pick: (c: CorpusChord) => number): number {
  const counts = new Map<number, number>();
  let best = pick(chords[0]);
  for (const chord of chords) {
    const value = pick(chord);
    counts.set(value, (counts.get(value) ?? 0) + 1);
    if ((counts.get(value) ?? 0) > (counts.get(best) ?? 0)) best = value;
  }
  return best;
}

function evaluateWindow(chords: readonly CorpusChord[], tally: Tally, examples: string[]) {
  const evidence = chords.map((c) => c.evidence);
  const started = performance.now();
  const found = findKey(evidence);
  tally.ms += performance.now() - started;
  const legacy = legacyFindKey(evidence);
  if (!found || !legacy) return;
  tally.windows++;
  const baselineTonic = mostCommonTonic(chords, (c) => c.evidence.chord.root);
  const annotatedTonic = mostCommonTonic(chords, (c) => c.key.tonic);
  if (mod12(homeKeyOf(found.key).tonic) === annotatedTonic) tally.windowTonicV2++;
  if (homeKeyOf(legacy.key).tonic === annotatedTonic) tally.windowTonicLegacy++;

  const wrongHere: string[] = [];
  chords.forEach((chord, i) => {
    const box = found.analysis.boxes[i];
    const home = simple(box.reading.home);
    const legacyKey = simple(homeKeyOf(legacy.keys[i]));
    const accepted = [chord.key, ...(chord.pivot ? [chord.pivot] : [])];
    tally.chords++;
    if (box.ambiguous) tally.ambiguous++;
    if (accepted.some((k) => k.tonic === home.tonic)) tally.tonicV2++;
    if (accepted.some((k) => k.tonic === legacyKey.tonic)) tally.tonicLegacy++;
    if (accepted.some((k) => k.tonic === baselineTonic)) tally.tonicBaseline++;
    if (chord.key.mode !== null) {
      tally.keyed++;
      if (accepted.some((k) => matches(k, home))) tally.keyV2++;
      if (accepted.some((k) => matches(k, legacyKey))) tally.keyLegacy++;
    }
    const right = accepted.some((k) => matches(k, home));
    if (!right) {
      tally.wrongV2++;
      const listed = [box.reading, ...box.alternatives].some((r) => accepted.some((k) => matches(k, simple(r.home))));
      if (listed) tally.wrongListed++;
      const kind = relation(chord.key, home);
      tally.errors[kind] = (tally.errors[kind] ?? 0) + 1;
      wrongHere.push(chord.label);
    }
    if (chord.target) {
      tally.applied++;
      if (matches(chord.target, simple(box.reading.local))) tally.appliedV2++;
      if (matches(chord.target, legacyKey)) tally.appliedLegacy++;
    }
  });
  if (wrongHere.length > chords.length / 2 && examples.length < 40) {
    const shown = chords.slice(0, EXAMPLE_CHORDS);
    const column = (texts: readonly string[]) => texts.map((t) => t.padEnd(9)).join('');
    examples.push(
      [
        `chords    ${column(shown.map((c) => c.label))}`,
        `annotated ${column(shown.map((c) => keyText(c.key)))}`,
        `v2 home   ${column(found.analysis.boxes.slice(0, EXAMPLE_CHORDS).map((b) => keyText(simple(b.reading.home))))}`,
        `before    ${column(legacy.keys.slice(0, EXAMPLE_CHORDS).map((k) => keyText(simple(homeKeyOf(k)))))}`,
      ].join('\n'),
    );
  }
}

const percent = (hit: number, total: number) => (total === 0 ? '—' : `${((100 * hit) / total).toFixed(1)}%`);

it('evaluates the harmonic analysis against the corpora', () => {
  const lines: string[] = [
    `# Corpus evaluation, ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    '',
    `${WINDOW > 0 ? `Windows of up to ${WINDOW} chord changes` : 'Whole pieces'}, each read by Find key with no preset key. "v2" is the harmonic analysis (its home key); "before" is the key finder from commit 0ce8623; "baseline" takes the most common chord root as the tonic.`,
    '',
    '| Corpus | Group | Pieces | Windows | Chords | Tonic v2 | Tonic before | Tonic baseline | Key v2 | Key before | V/x shows target v2 | V/x before | Wrong but listed | Ambiguous | Window tonic v2 | Window tonic before | ms per window |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  const details: string[] = [];
  for (const source of SOURCES) {
    if (ONLY && !ONLY.includes(source.corpus)) continue;
    const loaded = source.load().slice(0, LIMIT);
    if (loaded.length === 0) {
      lines.push(`| ${source.corpus} | not found in ${ROOT} | | | | | | | | | | | | | | | |`);
      continue;
    }
    const tallies = new Map<string, Tally>();
    const examples: string[] = [];
    for (const { group, piece } of loaded) {
      for (const name of [group, 'all']) {
        if (!tallies.has(name)) tallies.set(name, emptyTally());
      }
      const groupTally = tallies.get(group) as Tally;
      const allTally = tallies.get('all') as Tally;
      groupTally.pieces++;
      if (group !== 'all') allTally.pieces++;
      const size = WINDOW > 0 ? WINDOW : piece.chords.length;
      for (let start = 0; start + MIN_WINDOW <= piece.chords.length; start += size) {
        const window = piece.chords.slice(start, start + size);
        if (window.length < MIN_WINDOW) continue;
        const scratch = emptyTally();
        evaluateWindow(window, scratch, examples);
        for (const target of group === 'all' ? [allTally] : [groupTally, allTally]) {
          for (const field of Object.keys(scratch) as (keyof Tally)[]) {
            if (field === 'errors') {
              for (const [kind, count] of Object.entries(scratch.errors)) target.errors[kind] = (target.errors[kind] ?? 0) + count;
            } else if (field !== 'pieces') {
              (target[field] as number) += scratch[field] as number;
            }
          }
        }
      }
    }
    const order = [...tallies.keys()].sort((a, b) => (a === 'all' ? 1 : b === 'all' ? -1 : a.localeCompare(b)));
    for (const group of order) {
      const t = tallies.get(group) as Tally;
      lines.push(
        `| ${source.corpus} | ${group} | ${t.pieces} | ${t.windows} | ${t.chords} | ${percent(t.tonicV2, t.chords)} | ${percent(t.tonicLegacy, t.chords)} | ${percent(t.tonicBaseline, t.chords)} | ${percent(t.keyV2, t.keyed)} | ${percent(t.keyLegacy, t.keyed)} | ${percent(t.appliedV2, t.applied)} (${t.applied}) | ${percent(t.appliedLegacy, t.applied)} | ${percent(t.wrongListed, t.wrongV2)} | ${percent(t.ambiguous, t.chords)} | ${percent(t.windowTonicV2, t.windows)} | ${percent(t.windowTonicLegacy, t.windows)} | ${(t.ms / Math.max(1, t.windows)).toFixed(1)} |`,
      );
    }
    const all = tallies.get('all') as Tally;
    const errorTotal = Object.values(all.errors).reduce((a, b) => a + b, 0);
    details.push(
      `## ${source.corpus}: how v2's wrong home keys relate to the annotated key`,
      '',
      ...Object.entries(all.errors)
        .sort((a, b) => b[1] - a[1])
        .map(([kind, count]) => `- ${kind}: ${count} (${percent(count, errorTotal)})`),
      '',
      `### ${source.corpus}: windows where v2 got most chords wrong (first ${examples.length})`,
      '',
      '```',
      ...examples,
      '```',
      '',
    );
  }
  const report = [...lines, '', ...details].join('\n');
  const reports = join(ROOT, 'reports');
  mkdirSync(reports, { recursive: true });
  // Runs limited to some corpora get their own names, so runs side by side don't overwrite each other.
  const scope = ONLY ? `-${ONLY.join('+')}` : '';
  writeFileSync(join(reports, `latest${scope}.md`), report);
  writeFileSync(join(reports, `corpus-eval${scope}-${Date.now()}.md`), report);
});
