const PAPER = '#FAF9F7';

/** Muted hues for key regions: light enough to sit behind dark text without fighting the dot colors. */
export const KEY_REGION_COLORS: readonly string[] = [
  '#E8E1CF',
  '#D8E5DA',
  '#DAE2EC',
  '#ECDCE0',
  '#E2DDED',
  '#DDE8E6',
  '#EDE3D6',
  '#E3E7D3',
];

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

/** Dark ink or white, whichever contrasts more with `hex`. */
export function labelInk(hex: string): string {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contrast with white equals contrast with #3A3A3A at a luminance of about 0.26.
  return luminance > 0.26 ? '#3A3A3A' : '#FFFFFF';
}
