import { createHash } from "node:crypto";
import { AuthError } from "./auth.ts";
import { hashPassword, newId } from "./crypto.ts";
import { getDb } from "./db.ts";

const RESET_TTL_MS = 30 * 60 * 1000;

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Buat token sekali pakai; mengembalikan token mentah untuk disisipkan ke link email. */
export function createPasswordResetToken(userId: string): string {
  const token = `${newId("rst")}${newId("")}`;
  const now = Date.now();
  getDb()
    .prepare(
      "INSERT INTO password_reset_tokens (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(newId("prt"), userId, tokenHash(token), now, now + RESET_TTL_MS);
  return token;
}

/** Tukar token + password baru jadi hash password. Token hangus setelah dipakai. */
export function consumePasswordResetToken(token: string, newPassword: string): void {
  if (newPassword.length < 8) {
    throw new AuthError("Password baru minimal 8 karakter.", 400);
  }
  const db = getDb();
  const row = db
    .prepare("SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at >= ?")
    .get(tokenHash(token), Date.now()) as { id: string; user_id: string } | undefined;
  if (!row) {
    throw new AuthError("Tautan reset tidak valid atau sudah kedaluwarsa.", 400);
  }
  const hash = hashPassword(newPassword);
  db.exec("BEGIN");
  try {
    db.prepare("UPDATE password_reset_tokens SET used_at = ? WHERE id = ?").run(Date.now(), row.id);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, row.user_id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
