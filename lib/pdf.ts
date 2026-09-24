import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

/**
 * Render markdown PRD menjadi file PDF (A4).
 *
 * Parser blok minimalis: heading (#/##/###), bullet, numbered list,
 * checkbox task (- [ ] / - [x]), quote, code fence, tabel (sebagai teks).
 * Inline markup (**bold**, `code`, [link](url)) dibersihkan, bukan dirender —
 * cukup untuk dokumen PRD yang rapi dan terbaca.
 */

const PAGE_W = 595.28; // A4 width (pt)
const PAGE_H = 841.89; // A4 height (pt)
const MARGIN = 56;
const MAX_W = PAGE_W - MARGIN * 2;
const LEADING = 1.35;

type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont; mono: PDFFont };

function stripInline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [label](url) -> label
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // **bold** -> bold
    .replace(/(`+)(.*?)\1/g, "$2") // `code` -> code
    .replace(/<\/?[^>]+>/g, "") // sisa tag HTML
    .trim();
}

function wrapLine(text: string, font: PDFFont, size: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= MAX_W || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

export async function renderPrdPdf(title: string, markdown: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    mono: await doc.embedFont(StandardFonts.Courier),
  };

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const pageCount = () => doc.getPageCount();

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN + 24) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  const drawWrapped = (text: string, font: PDFFont, size: number, indent = 0, gapAfter = 4) => {
    for (const line of wrapLine(text, font, size)) {
      ensureSpace(size * LEADING);
      page.drawText(line, { x: MARGIN + indent, y, size, font, color: rgb(0.12, 0.12, 0.12) });
      y -= size * LEADING;
    }
    y -= gapAfter;
  };

  const drawHeading = (text: string, size: number, gapBefore: number) => {
    y -= gapBefore;
    ensureSpace(size * LEADING + 4);
    drawWrapped(stripInline(text), fonts.bold, size, 0, 2);
    y -= 4;
  };

  let inCode = false;
  for (const raw of markdown.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (/^```/.test(line)) {
      inCode = !inCode;
      y -= 4;
      continue;
    }
    if (inCode) {
      drawWrapped(line || " ", fonts.mono, 9, 12, 0);
      continue;
    }
    if (!line.trim()) {
      y -= 6;
      continue;
    }
    const h1 = line.match(/^#\s+(.+)/);
    if (h1) {
      drawHeading(h1[1], 18, 10);
      continue;
    }
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) {
      drawHeading(h2[1], 14, 10);
      continue;
    }
    const h3 = line.match(/^#{3,4}\s+(.+)/);
    if (h3) {
      drawHeading(h3[1], 12, 8);
      continue;
    }
    const task = line.match(/^\s*[-*]\s*\[( |x|X)\]\s*(.+)$/);
    if (task) {
      const done = task[1].toLowerCase() === "x";
      const wrapped = wrapLine(stripInline(task[2]), fonts.regular, 10);
      wrapped.forEach((text, i) => {
        ensureSpace(10 * LEADING);
        if (i === 0) {
          page.drawRectangle({
            x: MARGIN,
            y: y - 2,
            width: 9,
            height: 9,
            borderWidth: 1,
            borderColor: rgb(0.3, 0.3, 0.3),
            color: done ? rgb(0.2, 0.5, 0.3) : rgb(1, 1, 1),
          });
        }
        page.drawText(text, { x: MARGIN + 16, y, size: 10, font: fonts.regular, color: rgb(0.12, 0.12, 0.12) });
        y -= 10 * LEADING;
      });
      y -= 4;
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)/);
    if (bullet) {
      drawWrapped(`•  ${stripInline(bullet[1])}`, fonts.regular, 10, 8);
      continue;
    }
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)/);
    if (ordered) {
      drawWrapped(stripInline(ordered[0].trim()), fonts.regular, 10, 8);
      continue;
    }
    const quote = line.match(/^>\s?(.*)/);
    if (quote) {
      drawWrapped(stripInline(quote[1]), fonts.italic, 10, 12);
      continue;
    }
    if (/^\|/.test(line)) {
      drawWrapped(stripInline(line.replace(/\|/g, " ").replace(/\s+/g, " ")), fonts.mono, 8.5, 8, 0);
      continue;
    }
    const hr = /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim());
    if (hr) {
      ensureSpace(14);
      page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.75, color: rgb(0.7, 0.7, 0.7) });
      y -= 12;
      continue;
    }
    drawWrapped(stripInline(line), fonts.regular, 10);
  }

  // Footer: nomor halaman + judul.
  const total = pageCount();
  for (let i = 0; i < total; i++) {
    const p = doc.getPage(i);
    p.drawText(`${i + 1} / ${total}`, {
      x: PAGE_W - MARGIN - 40,
      y: MARGIN - 24,
      size: 8,
      font: fonts.regular,
      color: rgb(0.5, 0.5, 0.5),
    });
    if (i > 0) {
      p.drawText(title.slice(0, 60), { x: MARGIN, y: MARGIN - 24, size: 8, font: fonts.regular, color: rgb(0.5, 0.5, 0.5) });
    }
  }

  return doc.save();
}
