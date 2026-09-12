// Acceptance test 9: voice leading.
import { describe, expect, it } from 'vitest';
import { circularDistance, pcSet, pcsOf } from '../pitch';
import { minTotalMotion, voiceLeading } from '../voiceleading';

/** Reference minimum over every injective assignment of the smaller set into the larger. */
function bruteForceMotion(a: number[], b: number[]): number {
  const [small, large] = a.length <= b.length ? [a, b] : [b, a];
  const used = large.map(() => false);
  let best = Infinity;
  const search = (i: number, cost: number) => {
    if (cost >= best) return;
    if (i === small.length) {
      best = cost;
      return;
    }
    for (let j = 0; j < large.length; j++) {
      if (used[j]) continue;
      used[j] = true;
      search(i + 1, cost + circularDistance(small[i], large[j]));
      used[j] = false;
    }
  };
  search(0, 0);
  return best;
}

describe('voice leading', () => {
  it('C major → F major: C is common, E→F and G→A step, total 3 (the spec\'s "4" is not the minimum)', () => {
    const vl = voiceLeading(pcSet([0, 4, 7]), pcSet([5, 9, 0]));
    expect(vl.totalMotion).toBe(3);
    expect(vl.motions.filter((m) => m.kind === 'common').map((m) => m.from)).toEqual([0]);
    expect(vl.motions.map((m) => [m.from, m.to, m.semitones, m.kind])).toEqual([
      [0, 0, 0, 'common'],
      [4, 5, 1, 'step'],
      [7, 9, 2, 'step'],
    ]);
    expect(vl.added).toEqual([]);
    expect(vl.dropped).toEqual([]);
  });

  it('a 4-note chord into a 3-note chord drops exactly one tone', () => {
    const vl = voiceLeading(pcSet([7, 11, 2, 5]), pcSet([0, 4, 7])); // G7 → C
    expect(vl.dropped).toHaveLength(1);
    expect(vl.dropped).toEqual([2]); // D drops; B→C and F→E resolve by step
    expect(vl.added).toEqual([]);
    expect(vl.totalMotion).toBe(2);
  });

  it('a 3-note chord into a 4-note chord adds exactly one tone', () => {
    const vl = voiceLeading(pcSet([0, 4, 7]), pcSet([0, 4, 7, 10])); // C → C7
    expect(vl.added).toEqual([10]);
    expect(vl.dropped).toEqual([]);
    expect(vl.totalMotion).toBe(0);
  });

  it('classifies leaps and signs motion by the shortest way round', () => {
    const [tritone] = voiceLeading(pcSet([0]), pcSet([6])).motions;
    expect(tritone).toMatchObject({ distance: 6, semitones: 6, kind: 'leap' });
    const [down] = voiceLeading(pcSet([0]), pcSet([10])).motions;
    expect(down).toMatchObject({ distance: 2, semitones: -2, kind: 'step' });
  });

  it('matches the brute-force minimum and reports the size difference as added/dropped', () => {
    let seed = 12345;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const randomSet = () => {
      const size = 1 + Math.floor(random() * 8);
      let set = 0;
      while (pcsOf(set).length < size) set |= 1 << Math.floor(random() * 12);
      return set;
    };
    for (let trial = 0; trial < 400; trial++) {
      const a = randomSet();
      const b = randomSet();
      const vl = voiceLeading(a, b);
      const sizeA = pcsOf(a).length;
      const sizeB = pcsOf(b).length;
      expect(vl.totalMotion, `${pcsOf(a)} → ${pcsOf(b)}`).toBe(bruteForceMotion(pcsOf(a), pcsOf(b)));
      expect(vl.added.length).toBe(Math.max(0, sizeB - sizeA));
      expect(vl.dropped.length).toBe(Math.max(0, sizeA - sizeB));
      expect(minTotalMotion(b, a)).toBe(vl.totalMotion);
    }
  });
});
