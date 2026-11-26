import assert from "node:assert/strict";
import test from "node:test";
import { buildImplementationPrompt } from "../lib/prd.ts";
import { buildFallbackQuestions, formatWizardSummary, parseQuestionsJson } from "../lib/questions.ts";
import { buildFeatureTree } from "../lib/roadmap.ts";
import { parseTasks, updateTaskStatusesInPrd } from "../lib/tasks.ts";

const SAMPLE_PRD = `# PRD: Toko Online Gua

## Fitur Utama
1. **Katalog & Pencarian** — Daftar barang dengan pencarian & filter kategori | sub: Daftar Barang, Pencarian, Filter Kategori
2. **Keranjang & Checkout** — Tambah barang dan bayar via QRIS | sub: Keranjang Belanja, Pilih Alamat, Bayar QRIS

## Task Breakdown untuk AI Coding Agent
- [ ] T1 — Setup skema database | fitur: Katalog & Pencarian | prioritas: utama | file: lib/db.ts | depends: none | kompleksitas: S
- [ ] T2 — Buat halaman katalog produk | fitur: Katalog & Pencarian | prioritas: penting | file: app/page.tsx | depends: T1 | kompleksitas: M
- [x] T3 — Halaman checkout & bayar QRIS | fitur: Keranjang & Checkout | prioritas: utama | file: app/checkout/page.tsx | depends: T2 | kompleksitas: L
`;

test("buildFallbackQuestions menghasilkan 5 pertanyaan kontekstual toko online", () => {
  const qs = buildFallbackQuestions("Aplikasi web toko online untuk jualan baju");
  assert.equal(qs.length, 5);
  assert.equal(qs[0].type, "text");
  assert.ok(qs[2].options && qs[2].options.length >= 4);
});

test("parseQuestionsJson fallback aman bila JSON rusak", () => {
  const qs = parseQuestionsJson("bukan json", "Aplikasi kasir warung kopi");
  assert.equal(qs.length, 5);
  assert.match(qs[2].question, /kasir/i);
});

test("formatWizardSummary merangkum stack dan jawaban", () => {
  const qs = buildFallbackQuestions("Aplikasi kasir kopi");
  const summary = formatWizardSummary({
    techMode: "custom",
    selectedStack: ["Next.js", "PostgreSQL"],
    customStack: "Prisma",
    referenceNote: "https://contoh.id",
    questions: qs,
    answers: { q1: { questionId: "q1", text: "Pemilik kedai kopi" } },
  });
  assert.match(summary, /Next\.js, PostgreSQL, Prisma/);
  assert.match(summary, /Pemilik kedai kopi/);
});

test("parseTasks & updateTaskStatusesInPrd mengubah status todo -> in_progress -> done -> failed", () => {
  const tasks = parseTasks(SAMPLE_PRD);
  assert.equal(tasks.length, 3);
  assert.equal(tasks[0].feature, "Katalog & Pencarian");
  assert.equal(tasks[0].priority, "utama");
  assert.equal(tasks[0].status, "todo");
  assert.equal(tasks[2].status, "done");

  const step1 = updateTaskStatusesInPrd(SAMPLE_PRD, ["T1"], "in_progress");
  const parsed1 = parseTasks(step1);
  assert.equal(parsed1[0].status, "in_progress");
  assert.equal(parsed1[0].done, false);

  const step2 = updateTaskStatusesInPrd(step1, ["T1", "T2"], "done");
  const parsed2 = parseTasks(step2);
  assert.equal(parsed2[0].status, "done");
  assert.equal(parsed2[0].done, true);
  assert.equal(parsed2[1].status, "done");

  const step3 = updateTaskStatusesInPrd(step2, ["T2"], "failed");
  const parsed3 = parseTasks(step3);
  assert.equal(parsed3[1].status, "failed");
  assert.equal(parsed3[1].done, false);
});

test("buildFeatureTree memetakan fitur, sub-fitur, dan task per fitur", () => {
  const tasks = parseTasks(SAMPLE_PRD);
  const tree = buildFeatureTree(SAMPLE_PRD, tasks);
  assert.equal(tree.length, 2);
  assert.equal(tree[0].title, "Katalog & Pencarian");
  assert.deepEqual(tree[0].subFeatures, ["Daftar Barang", "Pencarian", "Filter Kategori"]);
  assert.equal(tree[0].totalCount, 2);
  assert.equal(tree[1].doneCount, 1);
});

test("buildImplementationPrompt menyertakan task tersisa dan PRD", () => {
  const tasks = parseTasks(SAMPLE_PRD);
  const prompt = buildImplementationPrompt("Toko Online Gua", SAMPLE_PRD, tasks);
  assert.match(prompt, /2\/3 tersisa/);
  assert.match(prompt, /T1 — Setup skema database/);
  assert.match(prompt, /# PRD: Toko Online Gua/);
});
