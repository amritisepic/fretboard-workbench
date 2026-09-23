/**
 * Draws parts of a rendered element onto canvases, with no library: the element is cloned into an SVG
 * foreignObject together with the app's style rules and the Inter font as data URLs, loaded as an
 * image, and drawn. Media queries are left out, so the output never takes the phone layout.
 */

export interface Region {
  /** In CSS pixels from the element's top-left corner. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A frozen copy of an element that can draw any region of itself. */
export interface Snapshot {
  draw(region: Region, pixelWidth: number, pixelHeight: number): Promise<HTMLCanvasElement>;
}

/**
 * Export pages are white. The rest of the palette is the light theme's whatever the screen shows —
 * the stylesheet declares its tokens on `.export-root` as well as on `:root` for exactly that — since
 * the page is printed on paper.
 */
const PAGE_OVERRIDES = '.export-root { --paper: #ffffff; background: #ffffff; }';

let stylesPromise: Promise<string> | null = null;

function cssRules(): CSSRule[] {
  return Array.from(document.styleSheets).flatMap((sheet) => {
    try {
      return Array.from(sheet.cssRules);
    } catch {
      return [];
    }
  });
}

/** Style rules without media queries. The page-level rules (:root, body) apply to the export root instead. */
function styleRules(): string {
  const out: string[] = [];
  for (const rule of cssRules()) {
    if (!(rule instanceof CSSStyleRule)) continue;
    const selector = rule.selectorText;
    if (selector === ':root' || selector === 'body') out.push(`.export-root { ${rule.style.cssText} }`);
    else if (!/(^|,\s*)(html|body|#root)(\s*,|$)/.test(selector)) out.push(rule.cssText);
  }
  return out.join('\n');
}

/** Whether a unicode-range ("U+0-FF, U+131") includes a code point. An empty range covers everything. */
function coversCodePoint(range: string, codePoint: number): boolean {
  if (!range.trim()) return true;
  return range.split(',').some((part) => {
    const match = /U\+([0-9a-f?]+)(?:-([0-9a-f]+))?/i.exec(part.trim());
    if (!match) return false;
    const low = Number.parseInt(match[1].replace(/\?/g, '0'), 16);
    const high = match[2] ? Number.parseInt(match[2], 16) : Number.parseInt(match[1].replace(/\?/g, 'F'), 16);
    return codePoint >= low && codePoint <= high;
  });
}

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Font unreadable')));
    reader.onerror = () => reject(reader.error ?? new Error('Font unreadable'));
    reader.readAsDataURL(blob);
  });

/** The upright Inter faces for Latin and Latin Extended, which cover everything the app writes. */
async function fontFaces(): Promise<string> {
  const faces: string[] = [];
  for (const rule of cssRules()) {
    if (!(rule instanceof CSSFontFaceRule)) continue;
    const family = rule.style.getPropertyValue('font-family').replace(/["']/g, '').trim();
    if (family !== 'Inter Variable' || rule.style.getPropertyValue('font-style').trim() === 'italic') continue;
    const range = rule.style.getPropertyValue('unicode-range');
    if (!coversCodePoint(range, 0x41) && !coversCodePoint(range, 0x101)) continue;
    const source = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(rule.style.getPropertyValue('src'));
    if (!source) continue;
    try {
      const response = await fetch(new URL(source[1], rule.parentStyleSheet?.href ?? document.baseURI).href);
      if (!response.ok) continue;
      const url = await blobToDataUrl(await response.blob());
      faces.push(
        `@font-face { font-family: 'Inter Variable'; font-style: normal; font-weight: 100 900; ` +
          `src: url("${url}") format('woff2'); ${range ? `unicode-range: ${range};` : ''} }`,
      );
    } catch {
      // Without the font the export falls back to a system sans-serif.
    }
  }
  return faces.join('\n');
}

/** Everything the exported markup needs to look as it does on screen, gathered once per session. */
export function exportStyles(): Promise<string> {
  stylesPromise ??= fontFaces().then((fonts) => `${fonts}\n${styleRules()}\n${PAGE_OVERRIDES}`);
  return stylesPromise;
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The export could not be drawn.'));
    image.src = src;
  });

/** Copies `source` with the export styles once, so each page draws from the same markup. */
export async function snapshot(source: HTMLElement): Promise<Snapshot> {
  const css = await exportStyles();
  const fullWidth = Math.ceil(source.scrollWidth);
  const fullHeight = Math.ceil(source.scrollHeight);

  const root = document.createElement('div');
  root.className = 'export-root';
  root.style.width = `${fullWidth}px`;
  const style = document.createElement('style');
  style.textContent = css;
  root.append(style, source.cloneNode(true));
  const markup = new XMLSerializer().serializeToString(root);

  return {
    async draw(region, pixelWidth, pixelHeight) {
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelWidth}" height="${pixelHeight}" ` +
        `viewBox="${region.x} ${region.y} ${region.width} ${region.height}" preserveAspectRatio="none">` +
        `<foreignObject x="0" y="0" width="${Math.max(fullWidth, region.x + region.width)}" ` +
        `height="${Math.max(fullHeight, region.y + region.height)}">${markup}</foreignObject></svg>`;
      const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      // Give embedded fonts a moment to decode before the image is drawn.
      await image.decode().catch(() => undefined);

      const canvas = document.createElement('canvas');
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('This browser cannot draw the export.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, pixelWidth, pixelHeight);
      context.drawImage(image, 0, 0, pixelWidth, pixelHeight);
      return canvas;
    },
  };
}

export const canvasBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The export is too large to save.'))), type, quality),
  );
