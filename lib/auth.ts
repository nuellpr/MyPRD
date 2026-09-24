/**
 * Autentikasi: sesi berbasis cookie httpOnly + hash password scrypt.
 *
 * Catatan: email/password saja untuk MVP (sesuai roadmap Fase 1). OAuth Google
 * bisa ditambahkan nanti karena pemisahan ini hanya di layer route + repo.
 */
import { cookies } from "next/headers";
import { getDb, type UserRow } from "./db.ts";
import { hashPassword, newId, signSession, verifyPassword, verifySession } from "./crypto.ts";

export const SESSION_COOKIE = "myprd_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 hari

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  plan: string;
  createdAt: number;
}

export function toPublicUser(row: UserRow): PublicUser {
  return { id: row.id, email: row.email, name: row.name, plan: row.plan, createdAt: row.created_at };
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
    created_at: Date.now(),
  };
  getDb()
    .prepare("INSERT INTO users (id, email, name, password_hash, plan, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(row.id, row.email, row.name, row.password_hash, row.plan, row.created_at);
  return row;
}

export function authenticate(email: string, password: string): UserRow {
  const user = findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new AuthError("Email atau password salah.", 401);
  }
  return user;
}

export class AuthError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export async function setSessionCookie(userId: string): Promise<void> {
  const store = await cookies();
  const token = signSession({ userId, exp: Date.now() + SESSION_TTL_MS });
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
  store.delete(SESSION_COOKIE);
}

/** User yang sedang login, atau null. Dipakai di route handler & server component. */
export async function currentUser(): Promise<UserRow | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifySession(token);
  if (!payload) return null;
  return findUserById(payload.userId) ?? null;
}

export async function requireUser(): Promise<UserRow> {
  const user = await currentUser();
  if (!user) throw new AuthError("Belum login.", 401);
  return user;
}
