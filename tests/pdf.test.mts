import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { renderPrdPdf } = await import("../lib/pdf.ts");
const { PDFDocument } = await import("pdf-lib");

const SAMPLE = `# PRD: Aplikasi Kasir

## Ringkasan Produk
Aplikasi kasir & stok untuk toko kelontong dengan scan barcode.

## Fitur Utama
- Scan barcode produk
- Laporan penjualan harian

## Task Breakdown untuk AI Coding Agent
- [x] T1 — Setup project | file: package.json | depends: none | kompleksitas: S
- [ ] T2 — Halaman kasir | file: app/kasir/page.tsx | depends: T1 | kompleksitas: M

## Kriteria Selesai (Acceptance Criteria)
- [ ] Kasir bisa scan dan cetak struk

> Catatan: data tersimpan lokal (SQLite).

\`\`\`
npm run dev
\`\`\`

| Kolom | Tipe |
| id | text |
`;

describe("renderPrdPdf", () => {
  it("menghasilkan file PDF valid dengan header %PDF-", async () => {
    const bytes = await renderPrdPdf("Aplikasi Kasir", SAMPLE);
    assert.ok(bytes.length > 1000, `ukuran terlalu kecil: ${bytes.length}`);
    assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
  });

  it("halaman bisa dibuka dan jumlahnya masuk akal", async () => {
    const bytes = await renderPrdPdf("Aplikasi Kasir", SAMPLE);
    const doc = await PDFDocument.load(bytes);
    assert.ok(doc.getPageCount() >= 1);
  });

  it("input panjang menjadi multi-halaman", async () => {
    const long = `${SAMPLE}\n${"Paragraf panjang untuk mengisi halaman. ".repeat(400)}`;
    const bytes = await renderPrdPdf("Panjang", long);
    const doc = await PDFDocument.load(bytes);
    assert.ok(doc.getPageCount() > 1, `halaman: ${doc.getPageCount()}`);
  });

  it("markdown kosong tetap jadi PDF 1 halaman tanpa error", async () => {
    const bytes = await renderPrdPdf("Kosong", "");
    const doc = await PDFDocument.load(bytes);
    assert.equal(doc.getPageCount(), 1);
  });
});
