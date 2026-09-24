import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.APP_SECRET = "test-secret-untuk-unit-test-1234567890";
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "myprd-oauth-test-"));
process.env.DATABASE_PATH = path.join(tmpDir, "oauth.db");

const { signOAuthState, verifyOAuthState, googleAuthUrl, exchangeGoogleCode, fetchGoogleProfile, OAuthError } =
  await import("../lib/oauth.ts");
const { findOrCreateOAuthUser } = await import("../lib/repo.ts");
const { getDb } = await import("../lib/db.ts");

test("state roundtrip mempertahankan tujuan", () => {
  const verified = verifyOAuthState(signOAuthState("/dashboard/prj_123"));
  assert.equal(verified?.next, "/dashboard/prj_123");
});

test("state palsu/rusak ditolak", () => {
  assert.equal(verifyOAuthState("asal.teks"), null);
  assert.equal(verifyOAuthState(""), null);
  const good = signOAuthState("/dashboard");
  const bad = good.slice(0, -1) + (good.endsWith("A") ? "B" : "A");
  assert.equal(verifyOAuthState(bad), null);
});

test("state kedaluwarsa ditolak", () => {
  const body = Buffer.from(
    JSON.stringify({ nonce: "n", next: "/dashboard", exp: Date.now() - 1000 }),
  ).toString("base64url");
  const key = crypto.createHash("sha256").update(`oauth:${process.env.APP_SECRET}`).digest();
  const sig = crypto.createHmac("sha256", key).update(body).digest("base64url");
  assert.equal(verifyOAuthState(`${body}.${sig}`), null);
});

test("tujuan non-lokal difallback ke /dashboard", () => {
  assert.equal(verifyOAuthState(signOAuthState("https://jahat.example/"))?.next, "/dashboard");
  assert.equal(verifyOAuthState(signOAuthState("//jahat.example/x"))?.next, "/dashboard");
});

test("googleAuthUrl memuat parameter wajib", () => {
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  const url = new URL(googleAuthUrl("statetoken", "http://localhost:3000/api/auth/google/callback"));
  assert.equal(url.hostname, "accounts.google.com");
  assert.equal(url.searchParams.get("client_id"), "test-client-id");
  assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:3000/api/auth/google/callback");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("state"), "statetoken");
  assert.ok((url.searchParams.get("scope") ?? "").includes("email"));
});

test("exchangeGoogleCode sukses & gagal", async () => {
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ access_token: "tok-abc" }), { status: 200 })) as typeof fetch;
    assert.equal(await exchangeGoogleCode("code-1", "http://x/cb"), "tok-abc");

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error_description: "Redirect URI salah." }), { status: 400 })) as typeof fetch;
    await assert.rejects(exchangeGoogleCode("code-2", "http://x/cb"), (e: unknown) => {
      assert.ok(e instanceof OAuthError);
      assert.equal((e as { status?: number }).status, 502);
      assert.match((e as Error).message, /Redirect URI salah/);
      return true;
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("fetchGoogleProfile sukses & tolak email tak terverifikasi", async () => {
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ email: "Budi@Example.com", email_verified: true, name: "Budi" }), {
        status: 200,
      })) as typeof fetch;
    assert.deepEqual(await fetchGoogleProfile("tok"), { email: "budi@example.com", name: "Budi" });

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ email: "x@y.z", email_verified: false }), { status: 200 })) as typeof fetch;
    await assert.rejects(fetchGoogleProfile("tok"), /terverifikasi/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("findOrCreateOAuthUser: buat baru tanpa password, idempoten", () => {
  const first = findOrCreateOAuthUser("OAuth@Example.com", "OAuth User");
  assert.equal(first.email, "oauth@example.com");
  assert.equal(first.password_hash, null);
  const second = findOrCreateOAuthUser("oauth@example.com", "Nama Lain");
  assert.equal(second.id, first.id);
  const raw = getDb().prepare("SELECT password_hash FROM users WHERE id = ?").get(first.id) as {
    password_hash: null;
  };
  assert.equal(raw.password_hash, null);
});

test("migrasi: DB lama NOT NULL tetap kebaca + bisa tambah user OAuth", async () => {
  const legacyFile = path.join(tmpDir, "legacy.db");
  const { DatabaseSync } = await import("node:sqlite");
  const { migrateUsersPasswordNullable } = await import("../lib/db.ts");
  {
    const legacy = new DatabaseSync(legacyFile);
    legacy.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL DEFAULT '', password_hash TEXT NOT NULL,
        plan TEXT NOT NULL DEFAULT 'free', created_at INTEGER NOT NULL
      );
      INSERT INTO users VALUES ('usr_lama', 'lama@example.com', 'Lama', 'scrypt$1$2$3$4$5', 'pro', 1);
    `);
    migrateUsersPasswordNullable(legacy);
    const cols = legacy.prepare("PRAGMA table_info(users)").all() as { name: string; notnull: number }[];
    assert.equal(cols.find((c) => c.name === "password_hash")?.notnull, 0);
    const kept = legacy.prepare("SELECT * FROM users WHERE id = 'usr_lama'").get() as { plan: string };
    assert.equal(kept.plan, "pro");
    legacy.prepare("INSERT INTO users (id, email, name, password_hash, plan, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run("usr_baru", "baru@example.com", "Baru", null, "free", 2);
    legacy.close();
  }
  // Idempoten: dijalankan dua kali tidak merusak apa pun.
  {
    const again = new DatabaseSync(legacyFile);
    migrateUsersPasswordNullable(again);
    const count = (again.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
    assert.equal(count, 2);
    again.close();
  }
});
