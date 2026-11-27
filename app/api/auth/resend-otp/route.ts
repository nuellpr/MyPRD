import { findUserByEmail, readPending2faCookie } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { errorToResponse, jsonError, jsonOk, readJson } from "@/lib/http";
import { assertNotLocked } from "@/lib/lockout";
import { issueOtp, otpLockoutKey, type OtpPurpose } from "@/lib/otp";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const RESEND_RATE = { limit: 5, windowMs: 15 * 60 * 1000 };

/** Kirim ulang kode OTP untuk register, google, reset, atau 2FA. */
export async function POST(request: Request) {
  try {
    const limited = rateLimit(`resend:${clientIp(request)}`, RESEND_RATE.limit, RESEND_RATE.windowMs);
    if (!limited.allowed) return jsonOk({ ok: true });

    const body = await readJson<{ email?: unknown; purpose?: unknown }>(request);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const purpose: OtpPurpose =
      body.purpose === "google" || body.purpose === "reset" || body.purpose === "2fa" ? body.purpose : "register";

    if (purpose === "2fa") {
      const pending = await readPending2faCookie();
      if (!pending || pending.email.toLowerCase() !== email) {
        return jsonError("Sesi verifikasi 2FA kedaluwarsa. Silakan masuk ulang.", 401);
      }
    }

    if (email) {
      assertNotLocked(otpLockoutKey(email, purpose), purpose === "2fa" ? "Verifikasi 2FA" : "Verifikasi OTP");
    }

    const user = email ? findUserByEmail(email) : undefined;
    if (!user) return jsonOk({ ok: true });
    if (purpose !== "reset" && purpose !== "2fa" && user.email_verified !== 0) return jsonOk({ ok: true });

    const code = issueOtp(user.email, purpose, user.id);
    const subject =
      purpose === "reset"
        ? "Kode reset password MyPRD"
        : purpose === "2fa"
          ? "Kode 2FA masuk MyPRD"
          : "Verifikasi email MyPRD";
    const heading =
      purpose === "reset"
        ? "Kode reset password MyPRD kamu:"
        : purpose === "2fa"
          ? "Kode verifikasi 2FA MyPRD kamu:"
          : "Kode verifikasi MyPRD kamu:";
    try {
      await sendEmail({
        to: user.email,
        subject,
        html: `<p>${heading} <strong style="font-size:24px;letter-spacing:6px">${code}</strong></p><p>Berlaku 10 menit. Jangan bagikan kode ini ke siapa pun.</p>`,
      });
    } catch {
      // Jangan bocorkan kegagalan pengiriman ke klien (anti enumerasi).
    }

    const response: { ok: true; devCode?: string } = { ok: true };
    if (process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY) response.devCode = code;
    return jsonOk(response);
  } catch (error) {
    return errorToResponse(error);
  }
}
