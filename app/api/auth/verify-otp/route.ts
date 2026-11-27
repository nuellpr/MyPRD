import {
  clearPending2faCookie,
  findUserById,
  getUserTotpSecret,
  readPending2faCookie,
  setSessionCookie,
} from "@/lib/auth";
import { errorToResponse, jsonError, jsonOk, readJson } from "@/lib/http";
import { verifyOtp, verifyTotpAttempt, type OtpPurpose } from "@/lib/otp";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Verifikasi kode OTP / TOTP 2FA. Untuk register/google/2fa juga buat sesi setelah sukses. */
export async function POST(request: Request) {
  try {
    const limited = rateLimit(`verify:${clientIp(request)}`, 30, 5 * 60_000);
    if (!limited.allowed) return jsonError("Terlalu banyak percobaan. Coba lagi nanti.", 429);
    const body = await readJson<{ email?: unknown; code?: unknown; purpose?: unknown }>(request);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const purpose: OtpPurpose =
      body.purpose === "google" || body.purpose === "reset" || body.purpose === "2fa" ? body.purpose : "register";
    if (!email || !code) return jsonError("Kode OTP tidak valid.", 400);

    if (purpose === "2fa") {
      const pending = await readPending2faCookie();
      if (!pending || pending.email.toLowerCase() !== email) {
        return jsonError("Sesi verifikasi 2FA kedaluwarsa. Silakan masuk ulang.", 401);
      }
      const user = findUserById(pending.userId);
      if (!user) return jsonError("Akun tidak ditemukan.", 400);

      if (user.two_factor_method === "totp" && user.two_factor_secret_enc) {
        const secret = getUserTotpSecret(user);
        if (!secret) {
          return jsonError("Konfigurasi autentikator tidak valid. Hubungi admin atau nonaktifkan 2FA.", 400);
        }
        verifyTotpAttempt(email, secret, code);
      } else {
        verifyOtp(email, "2fa", code);
      }

      await clearPending2faCookie();
      await setSessionCookie(user.id);
      return jsonOk({ ok: true });
    }

    const userId = verifyOtp(email, purpose, code);
    if (purpose !== "reset") {
      const user = findUserById(userId);
      if (!user) return jsonError("Akun tidak ditemukan.", 400);
      await setSessionCookie(user.id);
    }
    return jsonOk({ ok: true });
  } catch (error) {
    return errorToResponse(error);
  }
}
