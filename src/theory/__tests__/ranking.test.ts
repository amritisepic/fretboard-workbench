// Acceptance tests 6, 7 and 8: scale ranking, plus key pinning.
import { describe, expect, it } from 'vitest';
import { SCALE_FAMILIES } from '../../data/scales';
import { identifyChord } from '../chords';
import { hasPc, pcOf, pcSet } from '../pitch';
import { rankScales } from '../ranking';
import { makeScaleRef, scaleRefName, scaleRefPcSet } from '../scales';

function chordOf(pitches: number[]) {
  const [candidate] = identifyChord(pitches);
  return { set: pcSet(pitches.map(pcOf)), candidate };
}

const HALF_DIMINISHED = chordOf([48, 51, 54, 58]); // C E♭ G♭ B♭
const sevenNoteNames = (rows: readonly { size: number; name: string }[]) =>
  rows.filter((r) => r.size === 7).map((r) => r.name);

describe('scale ranking', () => {
  it('test 6: with no previous box, C Locrian ranks first among 7-note scales', () => {
    const { rows } = rankScales(HALF_DIMINISHED.set, HALF_DIMINISHED.candidate);
    expect(sevenNoteNames(rows)[0]).toBe('C Locrian');
  });

  it('test 7: when the previous scale contains D, C Locrian ♮2 overtakes C Locrian', () => {
    for (const previous of [
      makeScaleRef('diatonic', 0, 'B♭'),
      makeScaleRef('diatonic', 0, 'F'),
      makeScaleRef('diatonic', 0, 'C'),
      makeScaleRef('diatonic', 5, 'G'),
      makeScaleRef('harmonicMinor', 0, 'G'),
    ]) {
      const names = rankScales(HALF_DIMINISHED.set, HALF_DIMINISHED.candidate, {
        previousScale: scaleRefPcSet(previous),
      }).rows.map((r) => r.name);
      expect(names.indexOf('C Locrian ♮2'), scaleRefName(previous)).toBeLessThan(names.indexOf('C Locrian'));
    }
  });

  it('test 7, exhaustively: every 7-note library scale with D but not D♭ puts C Locrian ♮2 first of the two', () => {
    const failures: string[] = [];
    for (const family of SCALE_FAMILIES.filter((f) => f.intervals.length === 7)) {
      for (let mode = 0; mode < 7; mode++) {
        for (let pc = 0; pc < 12; pc++) {
          const previous = makeScaleRef(family.id, mode, pc);
          const pcs = scaleRefPcSet(previous);
          if (!hasPc(pcs, 2) || hasPc(pcs, 1)) continue;
          const names = rankScales(HALF_DIMINISHED.set, HALF_DIMINISHED.candidate, { previousScale: pcs }).rows.map(
            (r) => r.name,
          );
          if (names.indexOf('C Locrian ♮2') > names.indexOf('C Locrian')) failures.push(scaleRefName(previous));
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('test 8: a scale missing only the perfect 5th ranks above one missing only the 3rd', () => {
    for (const pitches of [
      [48, 52, 55, 58], // C7
      [48, 51, 55, 58], // Cm7
      [48, 52, 55, 59], // Cmaj7
    ]) {
      const { set, candidate } = chordOf(pitches);
      const { rows } = rankScales(set, candidate);
      const indicesMissingOnly = (role: string) =>
        rows.flatMap((r, i) => (r.missing.length === 1 && r.missing[0].role === role ? [i] : []));
      const missingFifth = indicesMissingOnly('fifth');
      const missingThird = indicesMissingOnly('third');
      expect(missingFifth.length).toBeGreaterThan(0);
      expect(missingThird.length).toBeGreaterThan(0);
      expect(Math.max(...missingFifth)).toBeLessThan(Math.min(...missingThird));
    }
    const c7 = chordOf([48, 52, 55, 58]);
    const names = rankScales(c7.set, c7.candidate).rows.map((r) => r.name);
    expect(names.indexOf('C Whole Tone')).toBeLessThan(names.indexOf('C Dorian'));
  });

  it('tiers by which tones are missing', () => {
    const { rows } = rankScales(HALF_DIMINISHED.set, HALF_DIMINISHED.candidate);
    const byName = (name: string) => rows.find((r) => r.name === name);
    expect(byName('C Locrian')?.tier).toBe(0);
    expect(byName('C Dorian')?.tier).toBe(1); // only the ♭5 is missing (penalty 8)
    expect(byName('C Ionian')?.tier).toBe(2); // ♭3, ♭5 and ♭7 missing
    const tiers = rows.map((r) => r.tier);
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
    const tier2 = rows.filter((r) => r.tier === 2).map((r) => r.intersection);
    expect(tier2).toEqual([...tier2].sort((a, b) => b - a));
  });

  it('lists each interval structure once, rooted on the chord root', () => {
    const { rows } = rankScales(HALF_DIMINISHED.set, HALF_DIMINISHED.candidate);
    expect(new Set(rows.map((r) => r.pcs)).size).toBe(rows.length);
    expect(rows.every((r) => hasPc(r.pcs, 0))).toBe(true);
    expect(rows.filter((r) => r.name.includes('Whole Tone'))).toHaveLength(1);
  });

  it('offers the smallest non-zero intersections as the distant section', () => {
    const { rows, distant } = rankScales(HALF_DIMINISHED.set, HALF_DIMINISHED.candidate);
    const smallest = Math.min(...rows.filter((r) => r.intersection > 0).map((r) => r.intersection));
    expect(distant.length).toBeGreaterThan(0);
    expect(distant[0].intersection).toBe(smallest);
    expect(distant.every((r) => r.intersection > 0)).toBe(true);
    const sizes = distant.map((r) => r.intersection);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  });

  it('has no voice-leading term without a previous box', () => {
    const { rows } = rankScales(HALF_DIMINISHED.set, HALF_DIMINISHED.candidate);
    expect(rows.every((r) => r.voiceLeadingTerm === 0)).toBe(true);
  });
});

describe('key pinning', () => {
  it('pins a mode of the key that contains the chord, ahead of voice-leading preferences', () => {
    const { rows } = rankScales(HALF_DIMINISHED.set, HALF_DIMINISHED.candidate, {
      key: makeScaleRef('diatonic', 0, 'D♭'),
      previousScale: scaleRefPcSet(makeScaleRef('diatonic', 0, 'B♭')),
    });
    expect(rows[0].name).toBe('C Locrian');
    expect(rows.filter((r) => r.pinned).map((r) => r.name)).toEqual(['C Locrian']);
  });

  it('pins nothing when no mode of the key contains the chord', () => {
    const { rows } = rankScales(HALF_DIMINISHED.set, HALF_DIMINISHED.candidate, {
      key: makeScaleRef('diatonic', 0, 'B♭'),
    });
    expect(rows.some((r) => r.pinned)).toBe(false);
  });

  it('pins D Dorian for Dm7 in C major even though D Aeolian and D minor pentatonic score higher', () => {
    const dm7 = chordOf([50, 53, 57, 60]);
    const unpinned = rankScales(dm7.set, dm7.candidate).rows.map((r) => r.name);
    expect(unpinned.indexOf('D Aeolian')).toBeLessThan(unpinned.indexOf('D Dorian'));
    const { rows } = rankScales(dm7.set, dm7.candidate, { key: makeScaleRef('diatonic', 0, 'C') });
    expect(rows[0]).toMatchObject({ name: 'D Dorian', pinned: true });
  });
});
