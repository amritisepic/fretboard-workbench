// Acceptance test 1: bitmask operations.
import { describe, expect, it } from 'vitest';
import {
  FULL_SET,
  circularDistance,
  complement,
  difference,
  intersect,
  intervalsFrom,
  isSubset,
  parseDegree,
  pcSet,
  pcsOf,
  rotateIntervals,
  setSize,
  transpose,
  union,
} from '../pitch';

const ALL_SETS = Array.from({ length: 4096 }, (_, i) => i);

// Reference membership computed with arithmetic rather than bit operators.
const MEMBER = new Uint8Array(4096 * 12);
for (const s of ALL_SETS) for (let pc = 0; pc < 12; pc++) MEMBER[s * 12 + pc] = Math.floor(s / 2 ** pc) % 2;
const naivePcs = (s: number) => [...Array(12).keys()].filter((pc) => MEMBER[s * 12 + pc] === 1);

/** Collects failures inside hot loops so each test makes one assertion instead of millions. */
function failureLog() {
  const messages: string[] = [];
  let count = 0;
  return {
    check(ok: boolean, message: () => string) {
      if (ok) return;
      count++;
      if (messages.length < 5) messages.push(message());
    },
    assertNone() {
      expect({ count, firstFailures: messages }).toEqual({ count: 0, firstFailures: [] });
    },
  };
}

describe('pitch-class set bitmasks (all 4096 sets)', () => {
  it('pcSet / pcsOf / setSize round-trip', () => {
    const log = failureLog();
    for (const s of ALL_SETS) {
      const pcs = pcsOf(s);
      const reference = naivePcs(s);
      log.check(pcs.join() === reference.join(), () => `pcsOf(${s})`);
      log.check(pcSet(pcs) === s, () => `pcSet(pcsOf(${s}))`);
      log.check(setSize(s) === reference.length, () => `setSize(${s})`);
    }
    log.assertNone();
  });

  it('transposition matches element-wise addition and inverts', () => {
    const log = failureLog();
    for (const s of ALL_SETS) {
      const pcs = naivePcs(s);
      for (let n = -12; n <= 12; n++) {
        const t = transpose(s, n);
        log.check(t === pcSet(pcs.map((pc) => (((pc + n) % 12) + 12) % 12)), () => `transpose(${s}, ${n})`);
        log.check(transpose(t, -n) === s, () => `transpose(transpose(${s}, ${n}), ${-n})`);
        log.check(setSize(t) === pcs.length, () => `setSize(transpose(${s}, ${n}))`);
      }
    }
    log.assertNone();
  });

  it('complement partitions the aggregate', () => {
    const log = failureLog();
    for (const s of ALL_SETS) {
      const c = complement(s);
      log.check(complement(c) === s && intersect(s, c) === 0 && union(s, c) === FULL_SET, () => `complement(${s})`);
    }
    log.assertNone();
  });

  it('intersection, union, difference and containment agree with the reference for every pair', () => {
    let failures = 0;
    for (let a = 0; a < 4096; a++) {
      for (let b = 0; b < 4096; b++) {
        let and = 0;
        let or = 0;
        let minus = 0;
        let subset = true;
        for (let pc = 0; pc < 12; pc++) {
          const inA = MEMBER[a * 12 + pc] === 1;
          const inB = MEMBER[b * 12 + pc] === 1;
          const weight = 2 ** pc;
          if (inA && inB) and += weight;
          if (inA || inB) or += weight;
          if (inA && !inB) {
            minus += weight;
            subset = false;
          }
        }
        if (intersect(a, b) !== and || union(a, b) !== or || difference(a, b) !== minus || isSubset(a, b) !== subset) {
          failures++;
        }
      }
    }
    expect(failures).toBe(0);
  }, 60_000);

  it('intersection round-trips through containment and commutes with transposition for every pair', () => {
    const log = failureLog();
    for (let a = 0; a < 4096; a++) {
      for (let b = 0; b < 4096; b++) {
        const i = intersect(a, b);
        log.check(isSubset(i, a) && isSubset(i, b), () => `${i} ⊄ ${a} ∩ ${b}`);
        log.check(isSubset(a, union(a, b)), () => `${a} ⊄ ${a} ∪ ${b}`);
        log.check(union(difference(a, b), i) === a, () => `(${a} − ${b}) ∪ (${a} ∩ ${b}) ≠ ${a}`);
        const n = (a ^ b) % 12;
        log.check(transpose(i, n) === intersect(transpose(a, n), transpose(b, n)), () => `T${n}(${a} ∩ ${b})`);
      }
    }
    log.assertNone();
  }, 60_000);
});

describe('interval helpers', () => {
  it('circular distance is at most 6 and symmetric', () => {
    for (let a = 0; a < 12; a++) {
      for (let b = 0; b < 12; b++) {
        const d = circularDistance(a, b);
        expect(d).toBe(circularDistance(b, a));
        expect(d).toBeLessThanOrEqual(6);
      }
    }
    expect(circularDistance(11, 1)).toBe(2);
  });

  it('rotates interval lists', () => {
    expect(rotateIntervals([0, 2, 4, 5, 7, 9, 11], 1)).toEqual([0, 2, 3, 5, 7, 9, 10]);
    expect(rotateIntervals([0, 2, 4, 5, 7, 9, 11], -1)).toEqual([0, 1, 3, 5, 6, 8, 10]);
    expect(intervalsFrom(pcSet([2, 5, 9]), 2)).toEqual([0, 3, 7]);
  });

  it('parses degree labels', () => {
    expect(parseDegree('♭3')).toEqual({ degree: 3, accidental: -1, semitones: 3 });
    expect(parseDegree('♯11').semitones).toBe(6);
    expect(parseDegree('bb7').semitones).toBe(9);
    expect(parseDegree('13').semitones).toBe(9);
  });
});
