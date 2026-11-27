/**
 * Utilitas kriptografi: hash password, token sesi, dan enkripsi data PRD
 * at-rest (PRD user bisa berisi ide bisnis sensitif).
 */
import crypto from "node:crypto";
import { appSecret } from "./env.ts";

const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  let actual: Buffer;
  try {
    actual = crypto.scryptSync(password, salt, expected.length, { N, r, p });
  } catch {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function derivedKey(purpose: string): Buffer {
  return crypto.createHash("sha256").update(`${purpose}:${appSecret()}`).digest();
}

function signTokenPayload<T extends object>(payload: T, purpose: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", derivedKey(purpose)).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyTokenPayload<T extends { exp?: unknown }>(token: string, purpose: string): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", derivedKey(purpose)).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export interface SessionPayload {
  userId: string;
  exp: number;
  /**
   * id sesi di tabel `sessions`. Opsional supaya token lama (tanpa `sid`) tetap
   * bisa diverifikasi tanda tangannya, lalu ditolak di `auth.currentUser()`
   * sehingga user diminta login ulang.
   */
  sid?: string;
}

/** Token sesi: payload base64url + HMAC-SHA256, disimpan di cookie httpOnly. */
export function signSession(payload: SessionPayload): string {
  return signTokenPayload(payload, "session");
}

export function verifySession(token: string): SessionPayload | null {
  const payload = verifyTokenPayload<SessionPayload>(token, "session");
  if (!payload || typeof payload.userId !== "string") return null;
  return payload;
}

export interface Pending2faPayload {
  userId: string;
  email: string;
  exp: number;
}

/** Token sementara pending 2FA setelah verifikasi password/OAuth sebelum input OTP. */
export function signTwoFactorToken(payload: Pending2faPayload): string {
  return signTokenPayload(payload, "2fa");
}

export function verifyTwoFactorToken(token: string): Pending2faPayload | null {
  const payload = verifyTokenPayload<Pending2faPayload>(token, "2fa");
  if (!payload || typeof payload.userId !== "string" || typeof payload.email !== "string") return null;
  return payload;
}

function contentKey(): Buffer {
  return crypto.createHash("sha256").update(`content:${appSecret()}`).digest();
}

/** Enkripsi AES-256-GCM, format: `v1.<iv>.<tag>.<ciphertext>` (semua base64url). */
export function encryptContent(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", contentKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptContent(payload: string): string {
  if (!payload.startsWith("v1.")) {
    // Data lama / tidak terenkripsi — kembalikan apa adanya agar tidak crash.
    return payload;
  }
  const [, ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Format ciphertext tidak valid.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", contentKey(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8");
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(12).toString("base64url")}`;
}

/** Fingerprint API key untuk log (tidak pernah menyimpan key mentah di log). */
export function fingerprint(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
}

/** Kode OTP 6 digit, aman kriptografis. */
export function generateOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}
