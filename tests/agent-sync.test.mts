import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "myprd-agent-sync-"));
process.env.DATABASE_PATH = path.join(tmpDir, "test.db");
process.env.APP_SECRET = "test-secret-agent-sync-1234567890abcdef";

const { getDb } = await import("../lib/db.ts");
const repo = await import("../lib/repo.ts");
const { buildImplementationPrompt } = await import("../lib/prd.ts");
const { parseTasks } = await import("../lib/tasks.ts");

const userId = "usr_sync_owner";
const otherUserId = "usr_sync_other";

test.before(() => {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO users (id, email, name, password_hash, plan, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  stmt.run(userId, "owner@example.com", "Owner", "scrypt$1$1$1$x$y", "free", Date.now());
  stmt.run(otherUserId, "other@example.com", "Other", "scrypt$1$1$1$x$y", "free", Date.now());
});

test("token agent project stabil saat diambil ulang, bisa diverifikasi, dan gugur setelah rotate", () => {
  const project = repo.createProject({
    userId,
    title: "Project Sync",
    idea: "test agent sync",
    modelId: "mock/myprd-demo",
    language: "id",
  });

  // User lain tidak boleh mendapat token project ini.
  assert.equal(repo.getOrCreateProjectAgentToken(otherUserId, project.id), null);
  assert.equal(repo.rotateProjectAgentToken(otherUserId, project.id), null);

  // Token pertama kali dibuat dan tetap sama pada pemanggilan berikutnya.
  const token1 = repo.getOrCreateProjectAgentToken(userId, project.id);
  assert.ok(token1 && token1.startsWith("agt_"));
  assert.equal(repo.getOrCreateProjectAgentToken(userId, project.id), token1);

  assert.equal(repo.verifyProjectAgentToken(project.id, token1), true);
  assert.equal(repo.verifyProjectAgentToken(project.id, `${token1}x`), false);
  assert.equal(repo.verifyProjectAgentToken(project.id, ""), false);
  assert.equal(repo.verifyProjectAgentToken("prj_tidak_ada", token1), false);

  // Rotate menerbitkan token baru dan menggugurkan token lama.
  const token2 = repo.rotateProjectAgentToken(userId, project.id);
  assert.ok(token2 && token2.startsWith("agt_"));
  assert.notEqual(token2, token1);
  assert.equal(repo.verifyProjectAgentToken(project.id, token1), false);
  assert.equal(repo.verifyProjectAgentToken(project.id, token2), true);
  assert.equal(repo.getOrCreateProjectAgentToken(userId, project.id), token2);
});

test("buildImplementationPrompt menyertakan perintah webhook hanya jika konfigurasi sync diberikan", () => {
  const samplePrd = `# PRD: Demo Sync

## Task Breakdown untuk AI Coding Agent
- [ ] T1 — Setup project | fitur: Inti | prioritas: utama | file: index.ts | depends: none | kompleksitas: S
`;
  const tasks = parseTasks(samplePrd);

  const staticPrompt = buildImplementationPrompt("Demo Sync", samplePrd, tasks);
  assert.equal(staticPrompt.includes("Authorization: Bearer"), false);

  const livePrompt = buildImplementationPrompt("Demo Sync", samplePrd, tasks, {
    webhookUrl: "https://myprd.site/api/projects/prj_123/tasks",
    token: "agt_contoh_token",
  });
  assert.match(livePrompt, /https:\/\/myprd\.site\/api\/projects\/prj_123\/tasks/);
  assert.match(livePrompt, /Authorization: Bearer agt_contoh_token/);
  assert.match(livePrompt, /"status":"in_progress"/);
  assert.match(livePrompt, /"status":"done"/);
});
