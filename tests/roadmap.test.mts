import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRoadmap, extractFeatureList, phaseHint } from "../lib/roadmap.ts";
import { parseTasks } from "../lib/tasks.ts";

const PRD = `# PRD: Aplikasi Kasir

## Fitur Utama

- **Catat transaksi** — kasir bisa mencatat penjualan dalam 3 detik
- Manajemen stok: stok berkurang otomatis setiap penjualan
- Laporan harian
- **Sinkronisasi multi perangkat** — antar HP dan tablet

Paragraf ini bukan daftar fitur dan harus diabaikan.

## Kriteria Selesai

- Kasir bisa mencatat penjualan.

## Task Breakdown untuk AI Coding Agent

- [ ] T1 — Setup project Next.js | file: package.json | depends: none | kompleksitas: S
- [ ] T2 — Skema database produk | file: lib/db.ts | depends: T1 | kompleksitas: M
- [ ] T3 — Halaman kasir | file: app/kasir/page.tsx | depends: T2 | kompleksitas: L
- [x] T4 — Setup CI | file: .github/workflows/ci.yml | depends: T1 | kompleksitas: S
- [ ] T5 — Laporan harian | file: app/laporan/page.tsx | depends: T2, T4 | kompleksitas: M
- [ ] T6 — Deploy panduan | file: README.md | depends: none | kompleksitas: S
`;

test("buildRoadmap mengelompokkan task per fase sesuai dependensi", () => {
  const roadmap = buildRoadmap(parseTasks(PRD));
  assert.equal(roadmap.phases.length, 3);
  assert.deepEqual(
    roadmap.phases.map((p) => p.tasks.map((t) => t.id)),
    [
      ["T1", "T6"],
      ["T2", "T4"],
      ["T3", "T5"],
    ],
  );
  assert.equal(roadmap.phases[0].title, "Fase 1");
  assert.equal(roadmap.phases[0].hint, "Fondasi & setup awal");
  assert.equal(roadmap.phases[1].hint, "Fitur inti");
  assert.equal(roadmap.phases[2].hint, "Penyelesaian & verifikasi");
  assert.equal(roadmap.stats.total, 6);
  assert.equal(roadmap.stats.done, 1);
});

test("buildRoadmap menghitung dependents dan key tasks", () => {
  const roadmap = buildRoadmap(parseTasks(PRD));
  assert.equal(roadmap.dependents.T1, 2);
  assert.equal(roadmap.dependents.T2, 2);
  assert.equal(roadmap.dependents.T3, undefined);
  assert.ok(roadmap.keyTasks.includes("T1"));
  assert.ok(roadmap.keyTasks.includes("T2"));
});

test("buildRoadmap menemukan jalur kritis terpanjang", () => {
  const roadmap = buildRoadmap(parseTasks(PRD));
  assert.deepEqual(roadmap.criticalPath, ["T1", "T2", "T3"]);
  const chain = buildRoadmap(
    parseTasks(`## Task Breakdown
- [ ] T1 — a | depends: none
- [ ] T2 — b | depends: T1
- [ ] T3 — c | depends: T2
`),
  );
  assert.deepEqual(chain.criticalPath, ["T1", "T2", "T3"]);
});

test("buildRoadmap toleran terhadap siklus dependensi", () => {
  const roadmap = buildRoadmap(
    parseTasks(`## Task Breakdown
- [ ] T1 — a | depends: T2
- [ ] T2 — b | depends: T1
`),
  );
  const ids = roadmap.phases.flatMap((p) => p.tasks.map((t) => t.id));
  assert.deepEqual([...ids].sort(), ["T1", "T2"]);
  assert.equal(new Set(roadmap.criticalPath).size, roadmap.criticalPath.length);
});

test("buildRoadmap pada daftar kosong menghasilkan peta kosong", () => {
  const roadmap = buildRoadmap([]);
  assert.deepEqual(roadmap.phases, []);
  assert.equal(roadmap.stats.total, 0);
  assert.deepEqual(roadmap.criticalPath, []);
  assert.deepEqual(roadmap.keyTasks, []);
});

test("phaseHint menyesuaikan jumlah fase", () => {
  assert.equal(phaseHint(0, 1), "Semua task bisa dikerjakan sekaligus");
  assert.equal(phaseHint(0, 3), "Fondasi & setup awal");
  assert.equal(phaseHint(1, 3), "Fitur inti");
  assert.equal(phaseHint(2, 3), "Penyelesaian & verifikasi");
});

test("extractFeatureList mengambil daftar fitur dari bagian Fitur Utama", () => {
  const features = extractFeatureList(PRD);
  assert.deepEqual(features, [
    "Catat transaksi",
    "Manajemen stok",
    "Laporan harian",
    "Sinkronisasi multi perangkat",
  ]);
});

test("extractFeatureList menghormati batas maksimum dan PRD tanpa bagian fitur", () => {
  assert.equal(extractFeatureList(PRD, 2).length, 2);
  assert.deepEqual(extractFeatureList("# PRD\n\n## Tujuan\n\n- sesuatu\n"), []);
});
