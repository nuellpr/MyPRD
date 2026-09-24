import assert from "node:assert/strict";
import test from "node:test";

process.env.APP_SECRET = "test-secret-untuk-unit-test-1234567890";

const { hashPassword, verifyPassword, signSession, verifySession, encryptContent, decryptContent, newId, fingerprint } =
  await import("../lib/crypto.ts");

test("hashPassword menghasilkan format scrypt$N$r$p$salt$hash", () => {
  const hash = hashPassword("rahasia123");
  const parts = hash.split("$");
  assert.equal(parts.length, 6);
  assert.equal(parts[0], "scrypt");
  assert.equal(parts[1], "16384");
});

test("verifyPassword menerima password benar dan menolak yang salah", () => {
  const hash = hashPassword("rahasia123");
  assert.equal(verifyPassword("rahasia123", hash), true);
  assert.equal(verifyPassword("rahasia124", hash), false);
});

test("verifyPassword menolak hash dengan format rusak", () => {
  assert.equal(verifyPassword("apa saja", "bukan-hash"), false);
  assert.equal(verifyPassword("apa saja", "scrypt$16384$8$1$xx"), false);
  assert.equal(verifyPassword("apa saja", "bcrypt$16384$8$1$c2FsdA$aGFzaA"), false);
});

test("hash berbeda untuk password sama (salt acak)", () => {
  assert.notEqual(hashPassword("sama"), hashPassword("sama"));
});

test("signSession & verifySession roundtrip", () => {
  const token = signSession({ userId: "usr_1", exp: Date.now() + 60_000 });
  const payload = verifySession(token);
  assert.ok(payload);
  assert.equal(payload?.userId, "usr_1");
});

test("verifySession menolak token kedaluwarsa, tanda tangan palsu, dan format aneh", () => {
  const expired = signSession({ userId: "usr_1", exp: Date.now() - 1000 });
  assert.equal(verifySession(expired), null);
  assert.equal(verifySession("abc.def"), null);
  assert.equal(verifySession(""), null);

  const valid = signSession({ userId: "usr_1", exp: Date.now() + 60_000 });
  const [body] = valid.split(".");
  assert.equal(verifySession(`${body}.tandatanganpalsu`), null);
});

test("verifySession menolak payload tanpa field wajib", () => {
  const token = signSession({ userId: "usr_1", exp: Date.now() + 60_000 });
  const [, sig] = token.split(".");
  const bogusBody = Buffer.from(JSON.stringify({ halo: "dunia" })).toString("base64url");
  // Tanda tangan asli tidak cocok dengan body baru → null (bukan lempar error).
  assert.equal(verifySession(`${bogusBody}.${sig}`), null);
});

test("encryptContent/decryptContent roundtrip termasuk teks unicode", () => {
  const plaintext = "PRD: aplikasi kasir 🧾\n- fitur: catat pesanan\n- target: warung kopi";
  const encrypted = encryptContent(plaintext);
  assert.ok(encrypted.startsWith("v1."));
  assert.ok(!encrypted.includes("kasir"));
  assert.equal(decryptContent(encrypted), plaintext);
});

test("ciphertext berbeda tiap enkripsi (IV acak)", () => {
  const a = encryptContent("isi sama");
  const b = encryptContent("isi sama");
  assert.notEqual(a, b);
  assert.equal(decryptContent(a), decryptContent(b));
});

test("decryptContent mengembalikan data lama yang tidak terenkripsi", () => {
  assert.equal(decryptContent("teks polos"), "teks polos");
});

test("decryptContent gagal kalau ciphertext diubah (auth tag)", () => {
  const encrypted = encryptContent("data penting");
  const parts = encrypted.split(".");
  const tampered = `${parts[0]}.${parts[1]}.${parts[2]}.${Buffer.from("diubah").toString("base64url")}`;
  assert.throws(() => decryptContent(tampered));
});

test("newId menghasilkan id unik dengan prefix", () => {
  const a = newId("prj");
  const b = newId("prj");
  assert.ok(a.startsWith("prj_"));
  assert.notEqual(a, b);
});

test("fingerprint deterministik dan tidak membocorkan nilai", () => {
  const key = "sk-rahasia-panjang";
  const fp = fingerprint(key);
  assert.equal(fp, fingerprint(key));
  assert.equal(fp.length, 12);
  assert.ok(!fp.includes("rahasia"));
});
