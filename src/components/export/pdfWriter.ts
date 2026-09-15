/**
 * A minimal PDF writer: one JPEG image per page, placed in a rectangle on a page of any size. The app
 * renders each page to a canvas first, so this is all a PDF export needs, with no library.
 */

export interface PdfImage {
  /** JPEG file bytes. */
  readonly bytes: Uint8Array;
  /** Pixel size of the image. */
  readonly width: number;
  readonly height: number;
}

export interface PdfPage {
  /** Page size in points (1/72 inch). */
  readonly width: number;
  readonly height: number;
  readonly image: PdfImage;
  /** Where the image is drawn, in points from the page's top-left corner. */
  readonly x: number;
  readonly y: number;
  readonly drawWidth: number;
  readonly drawHeight: number;
}

const number = (n: number) => String(Math.round(n * 100) / 100);

/** A PDF text string: UTF-16BE with a byte-order mark, as hex, so any title survives. */
function textString(text: string): string {
  let hex = 'FEFF';
  for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return `<${hex}>`;
}

export function buildPdf(pages: readonly PdfPage[], title = ''): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;

  const push = (data: string | Uint8Array) => {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: string, stream?: Uint8Array) => {
    offsets[id] = length;
    push(`${id} 0 obj\n${body}\n`);
    if (stream) {
      push('stream\n');
      push(stream);
      push('\nendstream\n');
    }
    push('endobj\n');
  };

  push('%PDF-1.4\n');
  // A comment of high bytes marks the file as binary for tools that guess.
  push(new Uint8Array([37, 226, 227, 207, 211, 10]));

  const pageId = (i: number) => 4 + i * 3;
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  object(3, `<< /Title ${textString(title)} /Producer ${textString('Fretboard Workbench')} >>`);

  pages.forEach((page, i) => {
    const id = pageId(i);
    const content = encoder.encode(
      `q ${number(page.drawWidth)} 0 0 ${number(page.drawHeight)} ${number(page.x)} ${number(page.height - page.y - page.drawHeight)} cm /Im0 Do Q`,
    );
    object(
      id,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${number(page.width)} ${number(page.height)}] ` +
        `/Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`,
    );
    object(id + 1, `<< /Length ${content.length} >>`, content);
    object(
      id + 2,
      `<< /Type /XObject /Subtype /Image /Width ${page.image.width} /Height ${page.image.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.image.bytes.length} >>`,
      page.image.bytes,
    );
  });

  const objectCount = 3 + pages.length * 3;
  const xref = length;
  push(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= objectCount; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
