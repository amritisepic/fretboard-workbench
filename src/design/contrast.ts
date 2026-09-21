/**
 * Contrast arithmetic for the design tokens, so the palette can be checked rather than eyeballed.
 *
 * WCAG 2.2 asks for 4.5:1 behind body text, 3:1 behind large text (18.66px bold or 24px plain), and
 * 3:1 for the visual boundary of a control (1.4.11). Decorative rules and separators are exempt.
 *
 * Pure: no DOM, no imports. The stylesheet is read by the test, not by this module.
 */

/** Minimum contrast for each kind of thing a color sits behind. */
export const MINIMUM = {
  /** Anything under 18.66px bold or 24px plain. */
  bodyText: 4.5,
  largeText: 3,
  /** The edge of an input, button or panel: what tells you the control is there. */
  controlBoundary: 3,
} as const;

export type Rgb = readonly [number, number, number];

/** "#abc", "#aabbcc" → channel values. Throws on anything else, so a typo can't pass silently. */
export function parseHex(hex: string): Rgb {
  const digits = hex.trim().replace(/^#/, '');
  const full = digits.length === 3 ? [...digits].map((c) => c + c).join('') : digits;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`Not a hex color: "${hex}"`);
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Relative luminance, as WCAG defines it. */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two opaque colors, from 1 (identical) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** Rounded the way a report reads it, so a 4.4999 never looks like a pass. */
export const ratio = (a: string, b: string): number => Math.floor(contrast(a, b) * 100) / 100;

/**
 * The custom properties declared on `:root` in a stylesheet, by name without the leading dashes.
 * Only color values are kept; radii, fonts and the like are ignored.
 */
export function rootColorTokens(css: string): Readonly<Record<string, string>> {
  const block = /:root\s*\{([^}]*)\}/.exec(css);
  if (!block) throw new Error('No :root block in the stylesheet');
  const tokens: Record<string, string> = {};
  for (const [, name, value] of block[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    const color = value.trim();
    if (/^#[0-9a-f]{3,8}$/i.test(color)) tokens[name] = color;
  }
  return tokens;
}
