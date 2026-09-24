/**
 * Login via Google OAuth 2.0 (authorization code flow, tanpa SDK tambahan).
 *
 * Semua fungsi di sini murni (tidak menyentuh `next/headers`) supaya bisa
 * di-unit-test langsung dengan `node --test`. Sesi tetap memakai cookie
 * yang sama dengan login email/password (`lib/auth.ts`).
 */
import crypto from "node:crypto";
import { appSecret } from "./env.ts";

export interface GoogleProfile {
  email: string;
  name: string;
}

export class OAuthError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "OAuthError";
    this.status = status;
  }
}

/** True kalau kredensial Google sudah diisi di env. */
export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

function googleClientId(): string {
  return process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
}

function googleClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
}

/**
 * Redirect URI yang didaftarkan di Google Cloud Console. Bisa di-override
 * via env (mis. di balik reverse proxy); default mengikuti origin request.
 */
export function googleRedirectUri(origin: string): string {
  const explicit = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return `${origin.replace(/\/$/, "")}/api/auth/google/callback`;
}

/** URL halaman persetujuan Google. */
export function googleAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: googleClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** Tukar authorization code dengan access token. */
export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: googleClientId(),
        client_secret: googleClientSecret(),
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });
  } catch {
    throw new OAuthError("Tidak bisa menghubungi Google. Coba lagi.", 502);
  }
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    // ponytail: pesan asli Google diteruskan apa adanya (membantu diagnosis salah redirect URI).
    throw new OAuthError(data.error_description ?? "Gagal menukar kode otorisasi Google.", 502);
  }
  return data.access_token;
}

/** Ambil profil (email + nama) pemegang access token. */
export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  let res: Response;
  try {
    res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new OAuthError("Tidak bisa mengambil profil Google. Coba lagi.", 502);
  }
  const data = (await res.json().catch(() => ({}))) as {
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  const email = (data.email ?? "").trim().toLowerCase();
  if (!res.ok || !email || data.email_verified === false) {
    throw new OAuthError("Email Google tidak valid atau belum terverifikasi.", 502);
  }
  return { email, name: (data.name ?? "").trim() || email.split("@")[0] };
}

function oauthKey(): Buffer {
  return crypto.createHash("sha256").update(`oauth:${appSecret()}`).digest();
}

const STATE_TTL_MS = 10 * 60 * 1000; // 10 menit

/** State anti-CSRF untuk OAuth: HMAC atas {nonce, next, exp}. */
export function signOAuthState(next: string, nonce?: string): string {
  const payload = {
    nonce: nonce ?? crypto.randomBytes(12).toString("base64url"),
    next,
    exp: Date.now() + STATE_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", oauthKey()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/**
 * Verifikasi state. Mengembalikan tujuan redirect yang aman
 * (selalu path lokal; fallback `/dashboard`).
 */
export function verifyOAuthState(token: string): { next: string } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", oauthKey()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      nonce?: unknown;
      next?: unknown;
      exp?: unknown;
    };
    if (typeof payload.nonce !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    const next = typeof payload.next === "string" && payload.next.startsWith("/") && !payload.next.startsWith("//")
      ? payload.next
      : "/dashboard";
    return { next };
  } catch {
    return null;
  }
}
