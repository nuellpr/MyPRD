import { clearPending2faCookie, findUserById, readPending2faCookie, setSessionCookie } from "@/lib/auth";
import { errorToResponse, jsonError, jsonOk, readJson } from "@/lib/http";
import { verifyOtp, type OtpPurpose } from "@/lib/otp";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/** Verifikasi kode OTP. Untuk register/google/2fa juga buat sesi setelah sukses. */
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
    }

    const userId = verifyOtp(email, purpose, code);
    if (purpose !== "reset") {
      const user = findUserById(userId);
      if (!user) return jsonError("Akun tidak ditemukan.", 400);
      if (purpose === "2fa") await clearPending2faCookie();
      await setSessionCookie(user.id);
    }
    return jsonOk({ ok: true });
  } catch (error) {
    return errorToResponse(error);
  }
}
