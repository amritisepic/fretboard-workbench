// Generates the app icons (PNG and SVG) from one small drawing: an off-white card with four
// strings, a nut, two frets, a clicked dot and a duller map dot. There are no image dependencies;
// the script includes its own tiny PNG encoder. Run with: npm run icons

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const PAPER = [250, 249, 247];
const INK = [58, 58, 58];
const RED = [200, 55, 45];
const MAP = [230, 171, 166];

/** The motif in unit coordinates, painted in order. */
const SHAPES = [
  ...[0.2, 0.4, 0.6, 0.8].map((y) => ({ kind: 'rect', x0: 0.12, x1: 0.92, y0: y - 0.016, y1: y + 0.016, color: INK })),
  { kind: 'rect', x0: 0.12, x1: 0.18, y0: 0.17, y1: 0.83, color: INK },
  { kind: 'rect', x0: 0.44, x1: 0.46, y0: 0.2, y1: 0.8, color: INK },
  { kind: 'rect', x0: 0.71, x1: 0.73, y0: 0.2, y1: 0.8, color: INK },
  { kind: 'circle', cx: 0.315, cy: 0.6, r: 0.095, color: MAP },
  { kind: 'circle', cx: 0.585, cy: 0.4, r: 0.095, color: RED },
];

/**
 * @param size   output edge in pixels
 * @param inset  fraction of the edge left clear around the motif
 * @param card   'rounded' draws a rounded off-white card on transparency; 'full' fills the square
 */
function render(size, inset, card) {
  const samples = 4;
  const pixels = Buffer.alloc(size * size * 4);
  const radius = 0.22;
  const insideCard = (u, v) => {
    if (card === 'full') return true;
    const dx = Math.max(radius - u, 0, u - (1 - radius));
    const dy = Math.max(radius - v, 0, v - (1 - radius));
    return dx * dx + dy * dy <= radius * radius;
  };
  const colorAt = (u, v) => {
    if (!insideCard(u, v)) return null;
    // Map card coordinates to motif coordinates.
    const x = (u - inset) / (1 - 2 * inset);
    const y = (v - inset) / (1 - 2 * inset);
    let color = PAPER;
    for (const shape of SHAPES) {
      const hit =
        shape.kind === 'rect'
          ? x >= shape.x0 && x <= shape.x1 && y >= shape.y0 && y <= shape.y1
          : (x - shape.cx) ** 2 + (y - shape.cy) ** 2 <= shape.r ** 2;
      if (hit) color = shape.color;
    }
    return color;
  };

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const color = colorAt((px + (sx + 0.5) / samples) / size, (py + (sy + 0.5) / samples) / size);
          if (!color) continue;
          r += color[0];
          g += color[1];
          b += color[2];
          covered++;
        }
      }
      const i = (py * size + px) * 4;
      if (covered > 0) {
        pixels[i] = Math.round(r / covered);
        pixels[i + 1] = Math.round(g / covered);
        pixels[i + 2] = Math.round(b / covered);
      }
      pixels[i + 3] = Math.round((covered / (samples * samples)) * 255);
    }
  }
  return encodePng(size, size, pixels);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const rows = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    rows[y * (width * 4 + 1)] = 0; // no filter
    rgba.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function svgIcon() {
  const toHex = ([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  const inset = 0.1;
  const scale = (1 - 2 * inset) * 64;
  const at = (value) => +(inset * 64 + value * scale).toFixed(2);
  const len = (value) => +(value * scale).toFixed(2);
  const body = SHAPES.map((shape) =>
    shape.kind === 'rect'
      ? `<rect x="${at(shape.x0)}" y="${at(shape.y0)}" width="${len(shape.x1 - shape.x0)}" height="${len(shape.y1 - shape.y0)}" fill="${toHex(shape.color)}"/>`
      : `<circle cx="${at(shape.cx)}" cy="${at(shape.cy)}" r="${len(shape.r)}" fill="${toHex(shape.color)}"/>`,
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${toHex(PAPER)}"/>${body}</svg>\n`;
}

const outputs = [
  ['icons/icon-192.png', render(192, 0.1, 'rounded')],
  ['icons/icon-512.png', render(512, 0.1, 'rounded')],
  // Maskable: full bleed, motif kept inside the central safe zone.
  ['icons/maskable-512.png', render(512, 0.2, 'full')],
  ['apple-touch-icon.png', render(180, 0.14, 'full')],
  ['favicon.svg', Buffer.from(svgIcon())],
];

for (const [path, data] of outputs) {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
  console.log(`wrote public/${path} (${data.length} bytes)`);
}
