import assert from "node:assert/strict";
import test from "node:test";

const { extractTaskSection, parseTasks, orderTasks, taskStats, tasksToJson, tasksToMarkdown } = await import("../lib/tasks.ts");

const PRD = `# PRD Aplikasi Kasir

## Fitur Utama
- Catat pesanan.

## Task Breakdown untuk AI Coding Agent
- [ ] T1 — Setup project Next.js | file: package.json | depends: none | kompleksitas: S
- [ ] T2 — Skema database | file: lib/db.ts | depends: T1 | kompleksitas: M
- [x] T3 — Halaman kasir | file: app/kasir/page.tsx, components/Cart.tsx | depends: T2 | kompleksitas: L
- [ ] T4 — Export laporan | file: lib/export.ts | depends: T2, T3 | kompleksitas: M

## Kriteria Selesai
- [ ] Bisa catat pesanan.
`;

test("extractTaskSection mengambil hanya bagian task breakdown", () => {
  const section = extractTaskSection(PRD);
  assert.ok(section);
  assert.match(section as string, /T1/);
  assert.ok(!(section as string).includes("Catat pesanan"));
});

test("extractTaskSection mengembalikan null kalau tidak ada", () => {
  assert.equal(extractTaskSection("# PRD\n\n## Fitur Utama\n- satu"), null);
});

test("parseTasks mengekstrak id, judul, file, depends, kompleksitas, dan status", () => {
  const tasks = parseTasks(PRD);
  assert.equal(tasks.length, 4);

  assert.equal(tasks[0].id, "T1");
  assert.equal(tasks[0].title, "Setup project Next.js");
  assert.deepEqual(tasks[0].files, ["package.json"]);
  assert.deepEqual(tasks[0].depends, []);
  assert.equal(tasks[0].complexity, "S");
  assert.equal(tasks[0].done, false);

  assert.deepEqual(tasks[2].files, ["app/kasir/page.tsx", "components/Cart.tsx"]);
  assert.equal(tasks[2].complexity, "L");
  assert.equal(tasks[2].done, true);

  assert.deepEqual(tasks[3].depends, ["T2", "T3"]);
});

test("parseTasks tidak mengambil checklist dari bagian Kriteria Selesai", () => {
  const tasks = parseTasks(PRD);
  assert.equal(tasks.some((t) => t.title.includes("Bisa catat pesanan")), false);
});

test("parseTasks tetap toleran kalau metadata tidak lengkap", () => {
  const tasks = parseTasks("## Task Breakdown\n- [ ] Bereskan auth\n- [ ] T7 — Tambah test");
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].id, "T1");
  assert.equal(tasks[0].title, "Bereskan auth");
  assert.equal(tasks[0].complexity, "?");
  assert.deepEqual(tasks[0].files, []);
  assert.equal(tasks[1].id, "T7");
  assert.equal(tasks[1].title, "Tambah test");
});

test("orderTasks mengurutkan berdasarkan dependency (T3 sebelum T2 tetap benar)", () => {
  const shuffled = parseTasks(`## Task Breakdown
- [ ] T4 — Export | depends: T2, T3
- [ ] T3 — Halaman kasir | depends: T2
- [ ] T1 — Setup
- [ ] T2 — Skema DB | depends: T1`);
  const ordered = orderTasks(shuffled).map((t) => t.id);
  assert.deepEqual(ordered, ["T1", "T2", "T3", "T4"]);
});

test("orderTasks tidak infinite loop saat ada siklus", () => {
  const cyclic = parseTasks(`## Task Breakdown
- [ ] T1 — A | depends: T2
- [ ] T2 — B | depends: T1`);
  const ordered = orderTasks(cyclic).map((t) => t.id).sort();
  assert.deepEqual(ordered, ["T1", "T2"]);
});

test("orderTasks mengabaikan dependency yang tidak ada", () => {
  const tasks = parseTasks("## Task Breakdown\n- [ ] T1 — A | depends: T99\n- [ ] T2 — B");
  assert.deepEqual(orderTasks(tasks).map((t) => t.id), ["T1", "T2"]);
});

test("taskStats menghitung total, selesai, kompleksitas, dan file unik", () => {
  const stats = taskStats(parseTasks(PRD));
  assert.equal(stats.total, 4);
  assert.equal(stats.done, 1);
  assert.deepEqual(stats.byComplexity, { S: 1, M: 2, L: 1, "?": 0 });
  // package.json, lib/db.ts, app/kasir/page.tsx, components/Cart.tsx, lib/export.ts
  assert.equal(stats.files, 5);
});

test("tasksToJson menghasilkan JSON terurut dengan field lengkap", () => {
  const parsed = JSON.parse(tasksToJson("Aplikasi Kasir", parseTasks(PRD)));
  assert.equal(parsed.project, "Aplikasi Kasir");
  assert.equal(parsed.tasks.length, 4);
  assert.deepEqual(parsed.tasks.map((t: { id: string }) => t.id), ["T1", "T2", "T3", "T4"]);
  assert.deepEqual(parsed.tasks[2].files, ["app/kasir/page.tsx", "components/Cart.tsx"]);
  assert.equal(parsed.tasks[2].done, true);
});

test("tasksToMarkdown menghasilkan checklist yang bisa diparse ulang", () => {
  const markdown = tasksToMarkdown("Aplikasi Kasir", parseTasks(PRD));
  assert.match(markdown, /^# Task Breakdown — Aplikasi Kasir/);
  assert.match(markdown, /Total: 4 task · Selesai: 1/);
  assert.match(markdown, /- \[x\] T3 — Halaman kasir \| file: app\/kasir\/page\.tsx, components\/Cart\.tsx \| depends: T2 \| kompleksitas: L/);

  // Roundtrip: hasil export bisa dibaca kembali oleh parser.
  const reparsed = parseTasks(markdown);
  assert.equal(reparsed.length, 4);
  assert.deepEqual(reparsed.map((t) => t.id), ["T1", "T2", "T3", "T4"]);
  assert.equal(reparsed[2].done, true);
  assert.equal(reparsed[3].depends.join(","), "T2,T3");
});

test("tasksToMarkdown tanpa task tetap menghasilkan header valid", () => {
  const markdown = tasksToMarkdown("Kosong", []);
  assert.match(markdown, /Total: 0 task/);
});
