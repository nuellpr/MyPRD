import { createHash, timingSafeEqual } from "node:crypto";
import { AuthError } from "./auth-error.ts";
import { generateOtp } from "./crypto.ts";
import { getDb } from "./db.ts";
import { assertNotLocked, clearLockout, MAX_AUTH_ATTEMPTS, recordFailedAttempt } from "./lockout.ts";
import { verifyTotpCode } from "./totp.ts";

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = MAX_AUTH_ATTEMPTS;

export type OtpPurpose = "register" | "google" | "reset" | "2fa";

const codeHash = (email: string, purpose: string, code: string) =>
  createHash("sha256").update(`${email.trim().toLowerCase()}|${purpose}|${code}`).digest();

/** Kunci lockout per email + purpose untuk cooldown 24 jam. */
export function otpLockoutKey(email: string, purpose: OtpPurpose): string {
  return `otp:${purpose}:${email.trim().toLowerCase()}`;
}

function otpLockoutLabel(purpose: OtpPurpose): string {
  return purpose === "2fa" ? "Verifikasi 2FA" : "Verifikasi OTP";
}

/** Buat kode OTP baru; kode lama untuk email+tujuan sama langsung hangus. */
export function issueOtp(email: string, purpose: OtpPurpose, userId: string): string {
  const normalized = email.trim().toLowerCase();
  assertNotLocked(otpLockoutKey(normalized, purpose), otpLockoutLabel(purpose));

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
  const lockKey = otpLockoutKey(normalized, purpose);
  const label = otpLockoutLabel(purpose);
  assertNotLocked(lockKey, label);

  const db = getDb();
  const row = db
    .prepare(
      "SELECT id, user_id, code_hash, attempts FROM otp_codes WHERE email = ? AND purpose = ? AND used_at IS NULL AND expires_at >= ? ORDER BY created_at DESC, rowid DESC LIMIT 1",
    )
    .get(normalized, purpose, Date.now()) as { id: string; user_id: string; code_hash: string; attempts: number } | undefined;
  if (!row) {
    const attempt = recordFailedAttempt(lockKey);
    if (attempt.locked) {
      throw new AuthError(
        `Percobaan gagal mencapai batas ${MAX_AUTH_ATTEMPTS} kali. ${label} dikunci selama 24 jam untuk menghindari ancaman peretasan akun.`,
        429,
      );
    }
    throw new AuthError("Kode OTP tidak valid atau sudah kedaluwarsa.", 400);
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    const attempt = recordFailedAttempt(lockKey);
    if (attempt.locked) {
      throw new AuthError(
        `Percobaan gagal mencapai batas ${MAX_AUTH_ATTEMPTS} kali. ${label} dikunci selama 24 jam untuk menghindari ancaman peretasan akun.`,
        429,
      );
    }
    throw new AuthError("Terlalu banyak percobaan. Minta kode baru.", 429);
  }

  const expected = Buffer.from(row.code_hash, "hex");
  const actual = codeHash(normalized, purpose, code.trim());
  const match = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!match) {
    const attempts = row.attempts + 1;
    const attempt = recordFailedAttempt(lockKey);
    db.prepare("UPDATE otp_codes SET attempts = ?, used_at = ? WHERE id = ?").run(
      attempts,
      attempts >= MAX_ATTEMPTS || attempt.locked ? Date.now() : null,
      row.id,
    );
    if (attempt.locked) {
      throw new AuthError(
        `Percobaan gagal mencapai batas ${MAX_AUTH_ATTEMPTS} kali. Verifikasi dikunci selama 24 jam untuk menghindari ancaman peretasan akun.`,
        429,
      );
    }
    throw new AuthError(
      `Kode OTP salah. Sisa percobaan: ${attempt.remainingAttempts} kali sebelum cooldown 24 jam.`,
      400,
    );
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
  clearLockout(lockKey);
  return row.user_id;
}

/** Verifikasi kode TOTP aplikasi autentikator dengan batas 5x gagal -> cooldown 24 jam. */
export function verifyTotpAttempt(email: string, secret: string, code: string): void {
  const lockKey = otpLockoutKey(email, "2fa");
  assertNotLocked(lockKey, "Verifikasi 2FA");
  if (!verifyTotpCode(secret, code)) {
    const attempt = recordFailedAttempt(lockKey);
    if (attempt.locked) {
      throw new AuthError(
        `Percobaan gagal mencapai batas ${MAX_AUTH_ATTEMPTS} kali. Verifikasi 2FA dikunci selama 24 jam untuk menghindari ancaman peretasan akun.`,
        429,
      );
    }
    throw new AuthError(
      `Kode autentikator salah. Sisa percobaan: ${attempt.remainingAttempts} kali sebelum cooldown 24 jam.`,
      400,
    );
  }
  clearLockout(lockKey);
}
