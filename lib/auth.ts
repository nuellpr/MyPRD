/**
 * Autentikasi: sesi berbasis cookie httpOnly + hash password scrypt,
 * plus login via Google OAuth (user OAuth tersimpan dengan password_hash NULL).
 *
 * Sesi dicatat juga di tabel `sessions`: cookie membawa `sid` bertanda tangan
 * HMAC, dan `currentUser()` menolak sesi yang barisnya sudah dihapus (logout)
 * atau sudah kedaluwarsa.
 */
import { cookies } from "next/headers";
import { AuthError } from "./auth-error.ts";
import { getDb, type UserRow } from "./db.ts";
import { createSession, getActiveSession, revokeSession } from "./repo.ts";
import { hashPassword, newId, signSession, verifyPassword, verifySession } from "./crypto.ts";

export const SESSION_COOKIE = "myprd_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 hari

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  plan: string;
  defaultModelId: string;
  phone: string;
  bio: string;
  createdAt: number;
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    plan: row.plan,
    defaultModelId: row.default_model_id,
    phone: row.phone,
    bio: row.bio,
    createdAt: row.created_at,
  };
}

export function findUserByEmail(email: string): UserRow | undefined {
  return getDb().prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as UserRow | undefined;
}

export function findUserById(id: string): UserRow | undefined {
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
}

export function createUser({ email, password, name }: CreateUserInput): UserRow {
  const normalized = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
    throw new AuthError("Format email tidak valid.", 400);
  }
  if (password.length < 8) {
    throw new AuthError("Password minimal 8 karakter.", 400);
  }
  if (findUserByEmail(normalized)) {
    throw new AuthError("Email sudah terdaftar. Silakan login.", 409);
  }
  const row: UserRow = {
    id: newId("usr"),
    email: normalized,
    name: (name ?? "").trim() || normalized.split("@")[0],
    password_hash: hashPassword(password),
    plan: "free",
    default_model_id: "",
    phone: "",
    bio: "",
    email_verified: 0,
    created_at: Date.now(),
  };
  getDb()
    .prepare(
      "INSERT INTO users (id, email, name, password_hash, plan, default_model_id, email_verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(row.id, row.email, row.name, row.password_hash, row.plan, row.default_model_id, row.email_verified, row.created_at);
  return row;
}

/** Simpan perubahan profil + preferensi model AI user. */
export function updateUserProfile(
  userId: string,
  patch: { name?: string; defaultModelId?: string; phone?: string; bio?: string },
): UserRow | null {
  const current = findUserById(userId);
  if (!current) return null;
  getDb()
    .prepare("UPDATE users SET name = ?, default_model_id = ?, phone = ?, bio = ? WHERE id = ?")
    .run(
      patch.name ?? current.name,
      patch.defaultModelId ?? current.default_model_id,
      patch.phone ?? current.phone,
      patch.bio ?? current.bio,
      userId,
    );
  return findUserById(userId) ?? null;
}

/** Ganti password setelah verifikasi password lama. User OAuth ditolak. */
export function changePassword(userId: string, currentPassword: string, newPassword: string): void {
  const user = findUserById(userId);
  if (!user || !user.password_hash) {
    throw new AuthError("Akun ini memakai Google. Ganti password tidak tersedia.", 400);
  }
  if (!verifyPassword(currentPassword, user.password_hash)) {
    throw new AuthError("Password lama salah.", 401);
  }
  if (newPassword.length < 8) {
    throw new AuthError("Password baru minimal 8 karakter.", 400);
  }
  getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(newPassword), userId);
}

export function authenticate(email: string, password: string): UserRow {
  const user = findUserByEmail(email);
  // User OAuth tidak punya password — tolak di sini (bukan 500 dari scrypt).
  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    throw new AuthError("Email atau password salah.", 401);
  }
  if (user.email_verified === 0) {
    throw new AuthError("Email belum terverifikasi. Cek kode OTP yang kami kirim.", 403);
  }
  return user;
}

export { AuthError } from "./auth-error.ts";

export async function setSessionCookie(userId: string): Promise<void> {
  const store = await cookies();
  // Sesi dicatat di server supaya logout bisa mencabutnya tanpa menunggu TTL.
  const session = createSession(userId, SESSION_TTL_MS);
  const token = signSession({ userId, sid: session.id, exp: session.expiresAt });
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  const payload = verifySession(store.get(SESSION_COOKIE)?.value ?? "");
  if (payload?.sid) revokeSession(payload.sid);
  store.delete(SESSION_COOKIE);
}

/** User yang sedang login, atau null. Dipakai di route handler & server component. */
export async function currentUser(): Promise<UserRow | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifySession(token);
  if (!payload?.sid) return null;
  // Sesi harus masih ada di server: belum dicabut (logout) dan belum kedaluwarsa.
  const session = getActiveSession(payload.sid);
  if (!session || session.userId !== payload.userId) return null;
  return findUserById(payload.userId) ?? null;
}

export async function requireUser(): Promise<UserRow> {
  const user = await currentUser();
  if (!user) throw new AuthError("Belum login.", 401);
  return user;
}
