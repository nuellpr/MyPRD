import assert from "node:assert/strict";
import test from "node:test";

process.env.APP_SECRET = "test-secret-totp-rfc6238-1234567890";

const totp = await import("../lib/totp.ts");
const cryptoLib = await import("../lib/crypto.ts");

// RFC 6238 Appendix B test vector secret untuk SHA-1: ASCII "12345678901234567890"
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("encodeBase32 dan decodeBase32 round-trip serta formatTOTP", () => {
  const raw = Buffer.from("12345678901234567890", "ascii");
  assert.equal(totp.encodeBase32(raw), RFC_SECRET);
  assert.deepEqual(totp.decodeBase32("gezd gnbv-gy3t qojq gezd gnbv gy3t qojq="), raw);

  const generated = totp.generateTotpSecret();
  assert.equal(generated.length, 32);
  assert.match(generated, /^[A-Z2-7]+$/);
  assert.equal(totp.formatTotpSecret(generated).replaceAll(" ", ""), generated);
});

test("totpCodeAt cocok dengan test vector RFC 6238 pada t=59s", () => {
  // Nilai 8 digit RFC 6238 untuk T=1 (59 detik) adalah 94287082 → 6 digit terakhir: 287082.
  assert.equal(totp.totpCodeAt(RFC_SECRET, 59_000), "287082");
});

test("verifyTotpCode menerima window ±30 detik dan menolak ±60 detik atau kode salah", () => {
  const baseMs = 59_000;
  const codeAt59s = totp.totpCodeAt(RFC_SECRET, baseMs);
  assert.equal(codeAt59s, "287082");

  // Window = 1 mengizinkan selisih ±30 detik (skew jam kecil).
  assert.equal(totp.verifyTotpCode(RFC_SECRET, codeAt59s, baseMs), true);
  assert.equal(totp.verifyTotpCode(RFC_SECRET, codeAt59s, baseMs + 30_000), true);
  assert.equal(totp.verifyTotpCode(RFC_SECRET, codeAt59s, baseMs - 30_000), true);

  // Di luar ±30 detik (±60 detik) harus ditolak.
  assert.equal(totp.verifyTotpCode(RFC_SECRET, codeAt59s, baseMs + 60_000), false);
  assert.equal(totp.verifyTotpCode(RFC_SECRET, codeAt59s, baseMs - 60_000), false);

  // Format bukan 6 digit atau angka salah ditolak.
  assert.equal(totp.verifyTotpCode(RFC_SECRET, "287083", baseMs), false);
  assert.equal(totp.verifyTotpCode(RFC_SECRET, "28708", baseMs), false);
});

test("buildOtpAuthUri dan renderTotpQrDataUrl menghasilkan URI & PNG QR valid", async () => {
  const uri = totp.buildOtpAuthUri("user+test@myprd.site", RFC_SECRET);
  assert.match(uri, /^otpauth:\/\/totp\/MyPRD:/);
  assert.ok(uri.includes(`secret=${RFC_SECRET}`));
  assert.ok(uri.includes("issuer=MyPRD"));
  assert.ok(uri.includes("digits=6"));
  assert.ok(uri.includes("period=30"));

  const dataUrl = await totp.renderTotpQrDataUrl(uri);
  assert.match(dataUrl, /^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
});

test("signTwoFactorSetupToken terisolasi dari token sesi dan pending 2FA login", () => {
  const token = cryptoLib.signTwoFactorSetupToken({
    userId: "usr_setup_1",
    secret: RFC_SECRET,
    exp: Date.now() + 60_000,
  });
  const parsed = cryptoLib.verifyTwoFactorSetupToken(token);
  assert.equal(parsed?.userId, "usr_setup_1");
  assert.equal(parsed?.secret, RFC_SECRET);
  assert.equal(cryptoLib.verifyTwoFactorSetupToken(`${token}x`), null);
  assert.equal(cryptoLib.verifySession(token), null);
  assert.equal(cryptoLib.verifyTwoFactorToken(token), null);
});
