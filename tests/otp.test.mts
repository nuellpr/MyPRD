import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// DB sementara supaya tidak menyentuh data/myprd.db milik development.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "myprd-otp-test-"));
process.env.DATABASE_PATH = path.join(tmpDir, "test.db");
process.env.APP_SECRET = "test-secret-untuk-unit-test-1234567890";

const { getDb } = await import("../lib/db.ts");
const { issueOtp, verifyOtp } = await import("../lib/otp.ts");

function seedUser(id: string, email: string) {
  getDb()
    .prepare("INSERT INTO users (id, email, name, password_hash, plan, created_at, email_verified) VALUES (?, ?, ?, NULL, 'free', ?, 0)")
    .run(id, email, "Tester", Date.now());
}

seedUser("usr_otp_1", "otp1@example.com");
seedUser("usr_otp_2", "otp2@example.com");

test("issueOtp → verifyOtp sukses, menandai email_verified", () => {
  const code = issueOtp("otp1@example.com", "register", "usr_otp_1");
  assert.match(code, /^\d{6}$/);
  assert.equal(verifyOtp("otp1@example.com", "register", code), "usr_otp_1");
  const row = getDb().prepare("SELECT email_verified FROM users WHERE id = ?").get("usr_otp_1") as { email_verified: number };
  assert.equal(row.email_verified, 1);
});

test("kode sekali pakai: verifikasi ulang gagal", () => {
  const code = issueOtp("otp2@example.com", "reset", "usr_otp_2");
  assert.equal(verifyOtp("otp2@example.com", "reset", code), "usr_otp_2");
  assert.throws(() => verifyOtp("otp2@example.com", "reset", code));
});

test("kode lama hangus setelah kode baru diterbitkan", () => {
  const first = issueOtp("otp2@example.com", "reset", "usr_otp_2");
  const second = issueOtp("otp2@example.com", "reset", "usr_otp_2");
  assert.notEqual(first, second);
  assert.throws(() => verifyOtp("otp2@example.com", "reset", first));
  assert.equal(verifyOtp("otp2@example.com", "reset", second), "usr_otp_2");
});

test("salah kode 5 kali mengunci OTP", () => {
  const code = issueOtp("otp1@example.com", "reset", "usr_otp_1");
  const wrong = code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) {
    assert.throws(() => verifyOtp("otp1@example.com", "reset", wrong));
  }
  assert.throws(() => verifyOtp("otp1@example.com", "reset", code));
});

test("OTP kedaluwarsa ditolak", () => {
  const code = issueOtp("otp2@example.com", "google", "usr_otp_2");
  getDb().prepare("UPDATE otp_codes SET expires_at = ? WHERE email = ? AND purpose = ?").run(Date.now() - 1000, "otp2@example.com", "google");
  assert.throws(() => verifyOtp("otp2@example.com", "google", code));
});

test("purpose berbeda tidak bisa saling pakai", () => {
  const code = issueOtp("otp1@example.com", "google", "usr_otp_1");
  assert.throws(() => verifyOtp("otp1@example.com", "register", code));
});
