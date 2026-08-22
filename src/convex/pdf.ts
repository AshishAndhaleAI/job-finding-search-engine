/**
 * Minimal dependency-free PDF writer for plain-text resumes.
 * Produces a valid multi-page PDF (Helvetica, wrapped lines) as bytes so the
 * engine can attach a real .pdf file to application emails.
 */

const PAGE_LINES = 46;
const LINE_HEIGHT = 14;
const TOP_Y = 792;
const MARGIN = 50;

function escapePdfText(s: string): string {
  return s
    .replace(/[^\x20-\x7E]/g, "?") // keep it simple ASCII
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapLine(line: string, max: number): string[] {
  if (line.length <= max) return [line];
  const out: string[] = [];
  let rest = line;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(" ", max);
    if (cut < max * 0.6) cut = max;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest.length > 0) out.push(rest);
  return out;
}

export function buildTextPdf(lines: string[]): Uint8Array {
  const wrapped: string[] = [];
  for (const line of lines) wrapped.push(...wrapLine(line, 95));

  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += PAGE_LINES) {
    pages.push(wrapped.slice(i, i + PAGE_LINES));
  }
  if (pages.length === 0) pages.push([""]);

  const contents = pages.map((plines) => {
    const body = plines.map((l) => `(${escapePdfText(l)}) Tj T*`).join("\n");
    return `BT\n/F1 11 Tf\n${MARGIN} ${TOP_Y - MARGIN} Td\n${LINE_HEIGHT} TL\n${body}\nET`;
  });

  // Object layout: 1=Catalog, 2=Pages, 3=Font, then pairs of (Page, Content).
  const objects: string[] = [];
  const pageCount = pages.length;
  const pageObjIds = pages.map((_, i) => 4 + i * 2);
  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[2] = `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`;
  objects[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
  pages.forEach((_, i) => {
    const pageId = 4 + i * 2;
    const contentId = pageId + 1;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] =
      `<< /Length ${contents[i].length} >>\nstream\n${contents[i]}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    if (!objects[id]) continue;
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xrefPos = pdf.length;
  const maxId = objects.length - 1;
  pdf += `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id++) {
    const off = offsets[id] ?? 0;
    pdf += `${off.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}

/** Bytes -> base64 (isolate-safe, no Buffer). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const SLICE = 0x8000;
  for (let i = 0; i < bytes.length; i += SLICE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + SLICE));
  }
  return btoa(binary);
}
