import { MINIMUM, contrast } from '../design/contrast';

const PAPER = '#FAF9F7';

/**
 * The fills behind the key bars, one per key. They are what tells one key region from the next at a
 * glance, so every pair is at least ΔE 15 apart (CIE76), where the beiges they replaced came as close
 * as 3. All eight share one lightness (L* 85) and one chroma (21.5), with their hues spaced evenly
 * round the circle, so no bar reads heavier than another and each is still a pale fill that the band
 * ink clears by 5.2:1 or more. The bar names its key in words as well, which is why the hues stop at
 * the separation the eye needs and go no further towards saturated blocks.
 *
 * The order is the order keys are met in, and each key after the first takes the hue furthest from
 * the ones before it: the home key is the sand the old palette started with, the second key the blue
 * opposite, the third and fourth the two hues a quarter turn from both. Keys that come early sit next
 * to each other most, and those four are at least ΔE 30 apart; the last four fill the gaps between.
 */
export const KEY_REGION_COLORS: readonly string[] = [
  '#E8D2AC',
  '#B9D7FC',
  '#A7E0D0',
  '#FBC6D8',
  '#C6DBB5',
  '#E0CDF3',
  '#9FDFEE',
  '#FDC9BB',
];

/**
 * Which of KEY_REGION_COLORS each region wears, as an index into it, given each region's color index
 * (one per distinct key, in the order keys are first met; see planKeys).
 *
 * A key keeps its color wherever it comes back, and the first eight keys simply take the palette in
 * order. A ninth key cannot have a color of its own, and wrapping it round to the first color put it
 * next to the first key in one of the examples the app ships (Blues for Alice): two regions in one
 * color, with nothing but the words to tell them apart. So a key past the eighth takes a color none
 * of its neighbours wear, anywhere it appears. Only a key bordering all eight colors has none left,
 * and then the one region where it would touch its twin is moved to another color, so that two
 * adjacent regions never share one.
 */
export function regionSlots(colorIndexes: readonly number[]): number[] {
  const count = KEY_REGION_COLORS.length;
  const neighbours = new Map<number, Set<number>>();
  colorIndexes.forEach((key, i) => {
    for (const other of [colorIndexes[i - 1], colorIndexes[i + 1]]) {
      if (other === undefined || other === key) continue;
      const set = neighbours.get(key) ?? new Set<number>();
      set.add(other);
      neighbours.set(key, set);
    }
  });

  // Keys are numbered in the order they are first met, so going up the numbers colors each key
  // after every key that came before it.
  const slotOf = new Map<number, number>();
  for (const key of [...new Set(colorIndexes)].sort((a, b) => a - b)) {
    if (key < count) {
      slotOf.set(key, key);
      continue;
    }
    const taken = new Set([...(neighbours.get(key) ?? [])].map((n) => slotOf.get(n)));
    const preferred = key % count;
    const free = Array.from({ length: count }, (_, step) => (preferred + step) % count).find((s) => !taken.has(s));
    slotOf.set(key, free ?? preferred);
  }

  const slots = colorIndexes.map((key) => slotOf.get(key) ?? 0);
  for (let i = 1; i < slots.length; i++) {
    if (slots[i] !== slots[i - 1]) continue;
    const next = slots[i + 1];
    slots[i] = Array.from({ length: count }, (_, s) => s).find((s) => s !== slots[i - 1] && s !== next) ?? 0;
  }
  return slots;
}

function parseHex(hex: string): [number, number, number] {
  const digits = hex.replace('#', '');
  const full = digits.length === 3 ? [...digits].map((c) => c + c).join('') : digits;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (channels: readonly number[]) =>
  `#${channels.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Blends `hex` over `base`; weight 1 returns `hex` unchanged. */
export function mix(hex: string, base: string, weight: number): string {
  const top = parseHex(hex);
  const bottom = parseHex(base);
  return toHex(top.map((v, i) => v * weight + bottom[i] * (1 - weight)));
}

/** The duller shade for map notes: the same hue pulled toward the paper. */
export function mapShade(hex: string): string {
  return mix(hex, PAPER, 0.4);
}

/** A pale tint of a box's color, behind dark text in the scale bar. */
export function bandShade(hex: string): string {
  return mix(hex, PAPER, 0.16);
}

/** The house ink, which a label on a light note is printed in. */
const INK = '#3A3A3A';
const WHITE = '#FFFFFF';
/**
 * For a mid-tone note, too light for white and too dark for the house ink. Between a luminance of
 * about 0.18 and 0.37 neither of those reaches 4.5:1, and a custom color may land there, as three of
 * the old dot colors did. Black clears 4.5:1 on every color white does not, so no color a user picks
 * is left without a readable label.
 */
const DEEP_INK = '#000000';

/**
 * The ink for a label printed on `hex`: the house ink or white, whichever contrasts more, as long as
 * that clears the 4.5:1 body text needs; black when neither does. It is chosen by the contrast it
 * gets rather than by a luminance threshold, which never checked its answer and so printed the old
 * orange and ochre dots' labels at 3.8:1 and 3.5:1.
 */
export function labelInk(hex: string): string {
  const house = contrast(WHITE, hex) >= contrast(INK, hex) ? WHITE : INK;
  return contrast(house, hex) >= MINIMUM.bodyText ? house : DEEP_INK;
}
