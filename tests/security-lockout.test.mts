import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "myprd-security-lockout-"));
process.env.DATABASE_PATH = path.join(tmpDir, "test.db");
process.env.APP_SECRET = "test-secret-security-lockout-1234567890";

const { getDb } = await import("../lib/db.ts");
const { AuthError } = await import("../lib/auth-error.ts");
const { signTwoFactorToken, verifySession, verifyTwoFactorToken } = await import("../lib/crypto.ts");
const lockout = await import("../lib/lockout.ts");
const otp = await import("../lib/otp.ts");
const repo = await import("../lib/repo.ts");

test("lockout mengunci selama 24 jam setelah 5 kali gagal dan pulih setelah masa cooldown", () => {
  const key = "login:victim@example.com";
  const base = 1_700_000_000_000;

  for (let i = 1; i <= 4; i++) {
    const res = lockout.recordFailedAttempt(key, base + i * 1000);
    assert.equal(res.locked, false);
    assert.equal(res.remainingAttempts, 5 - i);
  }

  const fifth = lockout.recordFailedAttempt(key, base + 5000);
  assert.equal(fifth.locked, true);
  assert.equal(fifth.remainingAttempts, 0);
  assert.equal(fifth.lockedUntil, base + 5000 + lockout.LOCKOUT_DURATION_MS);

  assert.throws(
    () => lockout.assertNotLocked(key, "Login", base + 60_000),
    (err: unknown) => err instanceof AuthError && err.status === 429 && /24 jam/.test(err.message),
  );

  // Setelah 24 jam berlalu, tidak terkunci lagi dan hitungan reset ke 1 pada gagal berikutnya.
  const after24h = fifth.lockedUntil + 1000;
  lockout.assertNotLocked(key, "Login", after24h);
  const resetAttempt = lockout.recordFailedAttempt(key, after24h);
  assert.equal(resetAttempt.failedCount, 1);
  assert.equal(resetAttempt.locked, false);
});

test("verifyTotpAttempt memvalidasi TOTP dan mengunci 24 jam setelah 5 kali salah", async () => {
  const { totpCodeAt } = await import("../lib/totp.ts");
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  const email = "totp-lock@example.com";
  const validCode = totpCodeAt(secret, Date.now());
  const wrongCode = validCode === "000000" ? "111111" : "000000";

  otp.verifyTotpAttempt(email, secret, validCode);

  for (let i = 0; i < 4; i++) {
    assert.throws(
      () => otp.verifyTotpAttempt(email, secret, wrongCode),
      (err: unknown) => err instanceof AuthError && err.status === 400,
    );
  }
  assert.throws(
    () => otp.verifyTotpAttempt(email, secret, wrongCode),
    (err: unknown) => err instanceof AuthError && err.status === 429 && /24 jam/.test(err.message),
  );
  assert.throws(
    () => otp.verifyTotpAttempt(email, secret, validCode),
    (err: unknown) => err instanceof AuthError && err.status === 429,
  );
});

test("OTP 2FA dan pendaftaran mengunci 24 jam setelah 5 kali salah", () => {
  const user = repo.findOrCreateOAuthUser("tfa-user@example.com", "User 2FA");

  const code = otp.issueOtp(user.email, "2fa", user.id);
  assert.match(code, /^\d{6}$/);
  assert.equal(otp.verifyOtp(user.email, "2fa", code), user.id);

  // 5 kali salah kode 2FA mengunci verifikasi dan issueOtp selama 24 jam.
  const code2 = otp.issueOtp(user.email, "2fa", user.id);
  const wrong = code2 === "000000" ? "111111" : "000000";
  for (let i = 0; i < 4; i++) {
    assert.throws(
      () => otp.verifyOtp(user.email, "2fa", wrong),
      (err: unknown) => err instanceof AuthError && err.status === 400,
    );
  }
  assert.throws(
    () => otp.verifyOtp(user.email, "2fa", wrong),
    (err: unknown) => err instanceof AuthError && err.status === 429,
  );
  assert.throws(
    () => otp.issueOtp(user.email, "2fa", user.id),
    (err: unknown) => err instanceof AuthError && err.status === 429,
  );

  // Pendaftaran (register) juga mengunci 24 jam setelah 5x gagal OTP.
  const regUser = repo.findOrCreateOAuthUser("reg-lock@example.com", "Reg User");
  const regCode = otp.issueOtp(regUser.email, "register", regUser.id);
  const regWrong = regCode === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) {
    assert.throws(() => otp.verifyOtp(regUser.email, "register", regWrong));
  }
  assert.throws(
    () => lockout.assertNotLocked(otp.otpLockoutKey(regUser.email, "register"), "Pendaftaran"),
    (err: unknown) => err instanceof AuthError && err.status === 429,
  );
});

test("token pending 2FA terisolasi dari token sesi", () => {
  const token = signTwoFactorToken({
    userId: "usr_1",
    email: "user@example.com",
    exp: Date.now() + 60_000,
  });
  const parsed = verifyTwoFactorToken(token);
  assert.equal(parsed?.userId, "usr_1");
  assert.equal(parsed?.email, "user@example.com");
  assert.equal(verifyTwoFactorToken(`${token}x`), null);
  assert.equal(verifySession(token), null);
});

test("kolom avatar_url, two_factor_enabled, dan deleteUserAccount menghapus akun beserta datanya", () => {
  const db = getDb();
  const user = repo.findOrCreateOAuthUser("avatar-del@example.com", "Avatar User");

  const sampleAvatar =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  db.prepare("UPDATE users SET avatar_url = ?, two_factor_enabled = 1 WHERE id = ?").run(sampleAvatar, user.id);

  const row = db
    .prepare("SELECT avatar_url, two_factor_enabled FROM users WHERE id = ?")
    .get(user.id) as { avatar_url: string; two_factor_enabled: number };
  assert.equal(row.avatar_url, sampleAvatar);
  assert.equal(row.two_factor_enabled, 1);

  const project = repo.createProject({
    userId: user.id,
    title: "Temp Project",
    idea: "hapus akun",
    modelId: "mock/myprd-demo",
    language: "id",
  });
  const session = repo.createSession(user.id, 60_000);

  assert.equal(repo.deleteUserAccount(user.id), true);
  assert.equal(repo.deleteUserAccount(user.id), false);
  assert.equal(db.prepare("SELECT id FROM users WHERE id = ?").get(user.id), undefined);
  assert.equal(repo.getActiveSession(session.id), null);
  assert.equal(db.prepare("SELECT id FROM projects WHERE id = ?").get(project.id), undefined);
});
