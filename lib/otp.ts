import { createHash, timingSafeEqual } from "node:crypto";
import { AuthError } from "./auth-error.ts";
import { generateOtp } from "./crypto.ts";
import { getDb } from "./db.ts";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export type OtpPurpose = "register" | "google" | "reset";

const codeHash = (email: string, purpose: string, code: string) =>
  createHash("sha256").update(`${email.trim().toLowerCase()}|${purpose}|${code}`).digest();

/** Buat kode OTP baru; kode lama untuk email+tujuan sama langsung hangus. */
export function issueOtp(email: string, purpose: OtpPurpose, userId: string): string {
  const normalized = email.trim().toLowerCase();
  const code = generateOtp();
  const now = Date.now();
  const db = getDb();
  db.exec("BEGIN");
  try {
    db.prepare("UPDATE otp_codes SET used_at = ? WHERE email = ? AND purpose = ? AND used_at IS NULL").run(
      now,
      normalized,
      purpose,
    );
    db.prepare(
      "INSERT INTO otp_codes (id, user_id, email, purpose, code_hash, created_at, expires_at, attempts) VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
    ).run(`otp_${createHash("sha256").update(`${normalized}${now}${code}`).digest("hex").slice(0, 16)}`, userId, normalized, purpose, codeHash(normalized, purpose, code).toString("hex"), now, now + OTP_TTL_MS);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return code;
}

/** Verifikasi kode OTP sekali pakai. Mengembalikan user_id yang terkait. */
export function verifyOtp(email: string, purpose: OtpPurpose, code: string): string {
  const normalized = email.trim().toLowerCase();
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, user_id, code_hash, attempts FROM otp_codes WHERE email = ? AND purpose = ? AND used_at IS NULL AND expires_at >= ? ORDER BY created_at DESC, rowid DESC LIMIT 1",
    )
    .get(normalized, purpose, Date.now()) as { id: string; user_id: string; code_hash: string; attempts: number } | undefined;
  if (!row) throw new AuthError("Kode OTP tidak valid atau sudah kedaluwarsa.", 400);
  if (row.attempts >= MAX_ATTEMPTS) throw new AuthError("Terlalu banyak percobaan. Minta kode baru.", 429);

  const expected = Buffer.from(row.code_hash, "hex");
  const actual = codeHash(normalized, purpose, code.trim());
  const match = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!match) {
    const attempts = row.attempts + 1;
    db.prepare("UPDATE otp_codes SET attempts = ?, used_at = ? WHERE id = ?").run(
      attempts,
      attempts >= MAX_ATTEMPTS ? Date.now() : null,
      row.id,
    );
    throw new AuthError("Kode OTP salah.", 400);
  }

  db.exec("BEGIN");
  try {
    db.prepare("UPDATE otp_codes SET used_at = ? WHERE id = ?").run(Date.now(), row.id);
    if (purpose === "register" || purpose === "google") {
      db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(row.user_id);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return row.user_id;
}
