import { MINIMUM, contrast } from '../design/contrast';

/** The two themes the stylesheet draws; see the tokens at the top of src/styles/base.css. */
export type Theme = 'light' | 'dark';

/** Each theme's page, as `--paper` declares it. The contrast tests hold the two to the same values. */
export const PAPER: Readonly<Record<Theme, string>> = { light: '#FAF9F7', dark: '#1B1A18' };

/**
 * The fills behind the key bars, one per key, as the custom properties that hold them. The colors
 * are in the stylesheet (`--region-1` to `--region-8`), each with its light and its dark value, which
 * is what lets a bar follow the theme, and lets the export sheet keep the light ones on any screen,
 * without this module knowing which theme is on.
 *
 * The order is the order keys are met in, and each key after the first takes the hue furthest from
 * the ones before it: the home key is the sand the old palette started with, the second key the blue
 * opposite, the third and fourth the two hues a quarter turn from both. Keys that come early sit next
 * to each other most, and those four are at least ΔE 30 apart; the last four fill the gaps between.
 */
export const KEY_REGION_COLORS: readonly string[] = Array.from({ length: 8 }, (_, i) => `var(--region-${i + 1})`);

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

/** How finely a dark color is lifted towards white until the dark page can show it. */
const LIFT_STEPS = 100;

/**
 * A box's color as a theme draws it.
 *
 * The box color is the user's, so the light theme draws exactly what they chose, and so does the
 * dark theme wherever that color clears 3:1 against the dark page: five of the eight dot colors do,
 * the default red among them. A note has to be seen before its label can be read, though, and blue,
 * violet and graphite came out at 2.8, 2.7 and 1.5:1 on the dark page, graphite all but invisible.
 * Those, and any custom color as dark, are lifted towards white just far enough to clear 3:1, which
 * keeps each one recognisably the color that was picked. The label is chosen against the lifted
 * color, so it stays readable too.
 */
export function dotColorIn(hex: string, theme: Theme): string {
  if (theme === 'light') return hex;
  for (let step = 0; step <= LIFT_STEPS; step++) {
    const lifted = step === 0 ? hex : mix(WHITE, hex, step / LIFT_STEPS);
    if (contrast(lifted, PAPER.dark) >= MINIMUM.graphic) return lifted;
  }
  return WHITE;
}

/**
 * The duller shade for map notes: the same hue pulled toward the page. The dark theme pulls a little
 * less, because the same share of a near-black page leaves the notes too close to it to find: at
 * these weights a map note stands about as far off the page in either theme (1.7–2.1:1 on the light
 * one, 1.6–1.8:1 on the dark).
 */
export function mapShadeIn(hex: string, theme: Theme): string {
  return mix(dotColorIn(hex, theme), PAPER[theme], theme === 'light' ? 0.4 : 0.5);
}

/**
 * A tint of a box's color, behind the key bar's text in its scale band: pale on the light page and
 * deep on the dark one, under the band ink of the same theme.
 */
export function bandShadeIn(hex: string, theme: Theme): string {
  return mix(dotColorIn(hex, theme), PAPER[theme], theme === 'light' ? 0.16 : 0.3);
}

/**
 * A color that depends on the theme, written as CSS: `light-dark()`, which the browser resolves by
 * the color scheme of the element it is drawn on. Inline styles and SVG paint therefore follow the
 * theme the way the stylesheet's tokens do, and the export sheet, which declares itself light, gets
 * the light value on any screen. Where the two themes agree the plain color is given instead.
 */
export function themed(pick: (theme: Theme) => string): string {
  const light = pick('light');
  const dark = pick('dark');
  return light.toLowerCase() === dark.toLowerCase() ? light : `light-dark(${light}, ${dark})`;
}

/** A box's color, for anything drawn in it: a note and its ring, a swatch, a chord tone's cell. */
export const dotColor = (hex: string): string => themed((theme) => dotColorIn(hex, theme));

/** The label printed on a note in the box's color. */
export const dotInk = (hex: string): string => themed((theme) => labelInk(dotColorIn(hex, theme)));

/** The highlight at the top of a clicked note: its color a quarter of the way to white. */
export const dotHighlight = (hex: string): string => themed((theme) => mix(dotColorIn(hex, theme), WHITE, 0.25));

/** A map note's fill. */
export const mapShade = (hex: string): string => themed((theme) => mapShadeIn(hex, theme));

/** The label printed on a map note. */
export const mapInk = (hex: string): string => themed((theme) => labelInk(mapShadeIn(hex, theme)));

/** The scale band's fill in the key bar. */
export const bandShade = (hex: string): string => themed((theme) => bandShadeIn(hex, theme));
