import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// DB sementara supaya tidak menyentuh data/myprd.db milik development.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "myprd-test-"));
process.env.DATABASE_PATH = path.join(tmpDir, "test.db");
process.env.APP_SECRET = "test-secret-untuk-unit-test-1234567890";
process.env.FREE_MONTHLY_QUOTA = "2";

const { getDb } = await import("../lib/db.ts");
const repo = await import("../lib/repo.ts");
const community = await import("../lib/community.ts");

function seedUser(id: string, name: string, plan: string): void {
  getDb()
    .prepare("INSERT INTO users (id, email, name, password_hash, plan, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, `${id}@example.com`, name, "scrypt$1$1$1$x$y", plan, Date.now());
}

function seedPrds(userId: string, count: number): void {
  for (let i = 0; i < count; i++) {
    const project = repo.createProject({ userId, title: `P${i}`, idea: "ide", modelId: "mock/myprd-demo", language: "id" });
    repo.savePrd(project.id, `# PRD ${i}\n\n## Kriteria Selesai\n\n- [ ] ok\n`);
  }
}

seedUser("usr_a", "Andi", "starter");
seedUser("usr_b", "Budi", "free");
seedUser("usr_c", "Cici", "free");
seedPrds("usr_a", 3);
seedPrds("usr_b", 1);

test("badgesForStats memberi lencana sesuai ambang", () => {
  assert.deepEqual(
    community.badgesForStats({ prdCount: 0, projectCount: 0, plan: "free" }).map((b) => b.id),
    [],
  );
  assert.deepEqual(
    community.badgesForStats({ prdCount: 1, projectCount: 1, plan: "free" }).map((b) => b.id),
    ["perintis"],
  );
  assert.deepEqual(
    community.badgesForStats({ prdCount: 3, projectCount: 3, plan: "starter" }).map((b) => b.id),
    ["perintis", "produktif", "pendukung"],
  );
  assert.deepEqual(
    community.badgesForStats({ prdCount: 10, projectCount: 10, plan: "pro" }).map((b) => b.id),
    ["perintis", "produktif", "maraton", "pendukung"],
  );
  assert.deepEqual(
    community.badgesForStats({ prdCount: 0, projectCount: 0, plan: "pro" }).map((b) => b.id),
    ["pendukung"],
  );
});

test("getUserStats menghitung PRD, project, dan paket", () => {
  assert.deepEqual(community.getUserStats("usr_a"), { prdCount: 3, projectCount: 3, plan: "starter" });
  assert.deepEqual(community.getUserStats("usr_b"), { prdCount: 1, projectCount: 1, plan: "free" });
  assert.deepEqual(community.getUserStats("usr_tak_ada"), { prdCount: 0, projectCount: 0, plan: "free" });
});

test("getLeaderboard urut per PRD dan mengecualikan yang belum punya PRD", () => {
  const board = community.getLeaderboard();
  assert.equal(board.length, 2);
  assert.equal(board[0].name, "Andi");
  assert.equal(board[0].prdCount, 3);
  assert.deepEqual(board[0].badges.map((b) => b.id), ["perintis", "produktif", "pendukung"]);
  assert.equal(board[1].name, "Budi");
  assert.ok(!board.some((entry) => entry.name === "Cici"));
});

test("getLeaderboard menghormati limit", () => {
  assert.equal(community.getLeaderboard(1).length, 1);
});
