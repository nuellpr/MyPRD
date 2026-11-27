/**
 * Proteksi brute-force berbasis SQLite: 5 kali gagal login/OTP/daftar/2FA
 * memicu cooldown 24 jam penuh per kunci akun/email.
 */
import { AuthError } from "./auth-error.ts";
import { getDb } from "./db.ts";

export const MAX_AUTH_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 24 * 60 * 60 * 1000;

export interface LockoutState {
  failedCount: number;
  locked: boolean;
  lockedUntil: number;
  remainingMs: number;
}

export interface FailedAttemptResult {
  failedCount: number;
  locked: boolean;
  lockedUntil: number;
  remainingAttempts: number;
}

/** Format sisa durasi cooldown ke bahasa Indonesia yang mudah dibaca. */
export function formatRemainingLockout(ms: number): string {
  if (ms <= 0) return "< 1 menit";
  const totalMinutes = Math.ceil(ms / 60_000);
  if (totalMinutes <= 1) return "< 1 menit";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes} menit`;
  if (minutes === 0) return `${hours} jam`;
  return `${hours} jam ${minutes} menit`;
}

/** Baca status lockout aktif untuk suatu key (`login:...` / `otp:...`). */
export function getLockoutState(key: string, now = Date.now()): LockoutState {
  const row = getDb()
    .prepare("SELECT failed_count, locked_until FROM auth_lockouts WHERE key = ?")
    .get(key) as { failed_count: number; locked_until: number } | undefined;
  if (!row) return { failedCount: 0, locked: false, lockedUntil: 0, remainingMs: 0 };
  if (row.locked_until > now) {
    return {
      failedCount: row.failed_count,
      locked: true,
      lockedUntil: row.locked_until,
      remainingMs: row.locked_until - now,
    };
  }
  const activeCount = row.locked_until > 0 && row.locked_until <= now ? 0 : row.failed_count;
  return { failedCount: activeCount, locked: false, lockedUntil: 0, remainingMs: 0 };
}

/** Lempar HTTP 429 apabila key sedang dalam masa cooldown 24 jam. */
export function assertNotLocked(key: string, label = "Verifikasi", now = Date.now()): void {
  const state = getLockoutState(key, now);
  if (!state.locked) return;
  throw new AuthError(
    `${label} dikunci selama 24 jam karena gagal ${MAX_AUTH_ATTEMPTS} kali berturut-turut (sisa ${formatRemainingLockout(state.remainingMs)}).`,
    429,
  );
}

/** Catat percobaan gagal dan aktifkan kunci 24 jam bila mencapai 5 kali. */
export function recordFailedAttempt(key: string, now = Date.now()): FailedAttemptResult {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const existing = db
      .prepare("SELECT failed_count, locked_until FROM auth_lockouts WHERE key = ?")
      .get(key) as { failed_count: number; locked_until: number } | undefined;

    if (existing && existing.locked_until > now) {
      db.exec("COMMIT");
      return {
        failedCount: existing.failed_count,
        locked: true,
        lockedUntil: existing.locked_until,
        remainingAttempts: 0,
      };
    }

    const baseCount = existing && !(existing.locked_until > 0 && existing.locked_until <= now) ? existing.failed_count : 0;
    const failedCount = baseCount + 1;
    const locked = failedCount >= MAX_AUTH_ATTEMPTS;
    const lockedUntil = locked ? now + LOCKOUT_DURATION_MS : 0;

    db.prepare(
      `INSERT INTO auth_lockouts (key, failed_count, locked_until, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         failed_count = excluded.failed_count,
         locked_until = excluded.locked_until,
         updated_at = excluded.updated_at`,
    ).run(key, failedCount, lockedUntil, now);

    db.exec("COMMIT");
    return {
      failedCount,
      locked,
      lockedUntil,
      remainingAttempts: Math.max(0, MAX_AUTH_ATTEMPTS - failedCount),
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** Reset hitungan gagal saat verifikasi atau login berhasil. */
export function clearLockout(key: string): void {
  getDb().prepare("DELETE FROM auth_lockouts WHERE key = ?").run(key);
}
