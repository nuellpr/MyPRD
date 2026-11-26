import { findUserById, setSessionCookie } from "@/lib/auth";
import { errorToResponse, jsonError, jsonOk, readJson } from "@/lib/http";
import { verifyOtp, type OtpPurpose } from "@/lib/otp";
import { AUTH_RATE_LIMIT, clientIp, rateLimit } from "@/lib/rate-limit";

/** Verifikasi kode OTP. Untuk register/google juga buat sesi setelah sukses. */
export async function POST(request: Request) {
  try {
    const limited = rateLimit(`verify:${clientIp(request)}`, AUTH_RATE_LIMIT.limit, AUTH_RATE_LIMIT.windowMs);
    if (!limited.allowed) return jsonError("Terlalu banyak percobaan. Coba lagi nanti.", 429);
    const body = await readJson<{ email?: unknown; code?: unknown; purpose?: unknown }>(request);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const purpose = body.purpose === "google" || body.purpose === "reset" ? body.purpose : "register";
    if (!email || !code) return jsonError("Kode OTP tidak valid.", 400);

    const userId = verifyOtp(email, purpose as OtpPurpose, code);
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
