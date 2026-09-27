import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Pakai DB sementara supaya tidak menyentuh data/myprd.db milik development.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "myprd-test-"));
process.env.DATABASE_PATH = path.join(tmpDir, "test.db");
process.env.APP_SECRET = "test-secret-untuk-unit-test-1234567890";
process.env.FREE_MONTHLY_QUOTA = "2";

const { getDb } = await import("../lib/db.ts");
const repo = await import("../lib/repo.ts");

const userId = "usr_test";

function seedUser(): void {
  getDb()
    .prepare("INSERT INTO users (id, email, name, password_hash, plan, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(userId, "test@example.com", "Tester", "scrypt$1$1$1$x$y", "free", Date.now());
}

test.before(seedUser);

test("createProject menyimpan project dengan status awal chatting", () => {
  const project = repo.createProject({ userId, title: "  Kasir Warung  ", idea: "catat pesanan", modelId: "mock/myprd-demo", language: "id" });
  assert.ok(project.id.startsWith("prj_"));
  assert.equal(project.title, "Kasir Warung");
  assert.equal(project.status, "chatting");
  assert.equal(project.userId, userId);
});

test("getProject selalu ter-scope ke pemiliknya", () => {
  const project = repo.createProject({ userId, title: "Milik Test", idea: "", modelId: "mock/myprd-demo", language: "id" });
  assert.ok(repo.getProject(userId, project.id));
  assert.equal(repo.getProject("usr_lain", project.id), null);
});

test("listProjects mengurutkan dari yang paling baru diubah", () => {
  const before = repo.listProjects(userId);
  const project = repo.createProject({ userId, title: "Terbaru", idea: "", modelId: "mock/myprd-demo", language: "id" });
  const after = repo.listProjects(userId);
  assert.equal(after[0].id, project.id);
  assert.equal(after.length, before.length + 1);
});

test("updateProject menolak project milik user lain dan mengubah updated_at", async () => {
  const project = repo.createProject({ userId, title: "Awal", idea: "", modelId: "mock/myprd-demo", language: "id" });
  assert.equal(repo.updateProject("usr_lain", project.id, { title: "Bajakan" }), null);

  await new Promise((r) => setTimeout(r, 5));
  const updated = repo.updateProject(userId, project.id, { title: "Diubah", status: "prd_ready" });
  assert.equal(updated?.title, "Diubah");
  assert.equal(updated?.status, "prd_ready");
  assert.ok((updated?.updatedAt ?? 0) > project.updatedAt);
});

test("pesan disimpan terenkripsi dan dibaca kembali urut", () => {
  const project = repo.createProject({ userId, title: "Chat", idea: "", modelId: "mock/myprd-demo", language: "id" });
  repo.addMessage(project.id, "user", "ide rahasia: aplikasi utang piutang");
  repo.addMessage(project.id, "assistant", "Siapa target usernya?");

  // Pastikan isi mentah di DB benar-benar terenkripsi.
  const raw = getDb().prepare("SELECT content_enc FROM messages WHERE project_id = ?").all(project.id) as unknown as {
    content_enc: string;
  }[];
  assert.equal(raw.length, 2);
  for (const row of raw) {
    assert.ok(row.content_enc.startsWith("v1."));
    assert.ok(!row.content_enc.includes("utang"));
  }

  const messages = repo.listMessages(project.id);
  assert.equal(messages.length, 2);
  assert.equal(messages[0].role, "user");
  assert.match(messages[0].content, /utang piutang/);
  assert.equal(messages[1].role, "assistant");
});

test("savePrd membuat versi 1 lalu menaikkan versi saat disimpan ulang", () => {
  const project = repo.createProject({ userId, title: "PRD", idea: "", modelId: "mock/myprd-demo", language: "id" });
  assert.equal(repo.getPrd(project.id), null);

  const first = repo.savePrd(project.id, "# PRD v1");
  assert.equal(first.version, 1);
  const second = repo.savePrd(project.id, "# PRD v2");
  assert.equal(second.version, 2);
  assert.equal(repo.getPrd(project.id)?.content, "# PRD v2");
});

test("PRD disimpan terenkripsi di kolom content_enc", () => {
  const project = repo.createProject({ userId, title: "PRD enc", idea: "", modelId: "mock/myprd-demo", language: "id" });
  repo.savePrd(project.id, "rahasia bisnis: resep rahasia");
  const row = getDb().prepare("SELECT content_enc FROM prds WHERE project_id = ?").get(project.id) as
    | { content_enc: string }
    | undefined;
  assert.ok(row?.content_enc.startsWith("v1."));
  assert.ok(!row?.content_enc.includes("resep"));
});

test("deleteProject menghapus project beserta pesan & PRD-nya (cascade)", () => {
  const project = repo.createProject({ userId, title: "Hapus", idea: "", modelId: "mock/myprd-demo", language: "id" });
  repo.addMessage(project.id, "user", "hai");
  repo.savePrd(project.id, "# PRD");

  assert.equal(repo.deleteProject(userId, project.id), true);
  assert.equal(repo.deleteProject(userId, project.id), false);
  assert.equal(repo.getProject(userId, project.id), null);
  assert.equal(repo.listMessages(project.id).length, 0);
  assert.equal(repo.getPrd(project.id), null);
});

test("getQuotaState menghitung kuota dari usage_events kind=prd bulan ini", () => {
  const project = repo.createProject({ userId, title: "Kuota", idea: "", modelId: "mock/myprd-demo", language: "id" });

  const initial = repo.getQuotaState(userId, "free");
  assert.equal(initial.limit, 2);

  repo.recordUsage({ userId, projectId: project.id, kind: "prd", provider: "mock", model: "myprd-demo", tokensIn: 10, tokensOut: 20, costUsd: 0 });
  // Chat tidak dihitung sebagai kuota generate.
  repo.recordUsage({ userId, projectId: project.id, kind: "chat", provider: "mock", model: "myprd-demo", tokensIn: 5, tokensOut: 5, costUsd: 0 });

  const afterOne = repo.getQuotaState(userId, "free");
  assert.equal(afterOne.used, initial.used + 1);
  assert.equal(afterOne.remaining, initial.remaining - 1);
  assert.equal(afterOne.allowed, true);

  repo.recordUsage({ userId, projectId: project.id, kind: "prd", provider: "mock", model: "myprd-demo", tokensIn: 10, tokensOut: 20, costUsd: 0 });
  const exhausted = repo.getQuotaState(userId, "free");
  assert.equal(exhausted.allowed, false);
  assert.equal(exhausted.remaining, 0);
});

test("reservasi kuota langsung terhitung dan bisa difinalkan / dibatalkan", () => {
  const project = repo.createProject({ userId, title: "Reservasi", idea: "", modelId: "mock/myprd-demo", language: "id" });
  const before = repo.getQuotaState(userId, "free").used;

  const usageId = repo.reserveUsage({ userId, projectId: project.id, kind: "prd" });
  // Inilah yang menutup race: kuota terpotong segera, bukan setelah stream selesai.
  assert.equal(repo.getQuotaState(userId, "free").used, before + 1);

  repo.finalizeUsage(usageId, { provider: "mock", model: "myprd-demo", tokensIn: 10, tokensOut: 20, costUsd: 0 });
  const row = getDb().prepare("SELECT provider, tokens_out FROM usage_events WHERE id = ?").get(usageId) as
    | { provider: string; tokens_out: number }
    | undefined;
  assert.equal(row?.provider, "mock");
  assert.equal(row?.tokens_out, 20);
  assert.equal(repo.getQuotaState(userId, "free").used, before + 1);

  const dibatalkan = repo.reserveUsage({ userId, projectId: project.id, kind: "prd" });
  repo.releaseUsage(dibatalkan);
  assert.equal(repo.getQuotaState(userId, "free").used, before + 1);
});

test("getQuotaState mengabaikan usage bulan lalu", () => {
  const before = repo.getQuotaState(userId, "pro").used;
  const old = Date.now() - 1000 * 60 * 60 * 24 * 70; // ~70 hari lalu
  getDb()
    .prepare(
      "INSERT INTO usage_events (id, user_id, project_id, kind, provider, model, tokens_in, tokens_out, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run("usg_old", userId, null, "prd", "mock", "myprd-demo", 1, 1, 0, old);

  const state = repo.getQuotaState(userId, "pro");
  assert.equal(state.used, before, "usage bulan lalu tidak boleh menambah kuota terpakai");
});

test("sesi tercatat di server: bisa dicabut (logout) dan kedaluwarsa", () => {
  const session = repo.createSession(userId, 60_000);
  assert.equal(repo.getActiveSession(session.id)?.userId, userId);

  repo.revokeSession(session.id); // logout
  assert.equal(repo.getActiveSession(session.id), null, "cookie lama harus mati setelah logout");

  const expired = repo.createSession(userId, -1_000);
  assert.equal(repo.getActiveSession(expired.id), null, "sesi kedaluwarsa tidak boleh aktif");
});


test("getUsageSummary mengagregasi total & per model", () => {
  const summary = repo.getUsageSummary(userId);
  assert.ok(summary.events >= 3);
  assert.equal(summary.totalTokensOut >= 20, true);
  const mock = summary.byModel.find((m) => m.model === "myprd-demo");
  assert.ok(mock);
  assert.ok(mock!.events >= 3);
});
