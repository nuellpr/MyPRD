import { findUserByEmail } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { errorToResponse, jsonOk, readJson } from "@/lib/http";
import { issueOtp, type OtpPurpose } from "@/lib/otp";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const RESEND_RATE = { limit: 5, windowMs: 15 * 60 * 1000 };

/** Kirim ulang kode OTP untuk register, google, atau reset. Selalu balas generik. */
export async function POST(request: Request) {
  try {
    const limited = rateLimit(`resend:${clientIp(request)}`, RESEND_RATE.limit, RESEND_RATE.windowMs);
    if (!limited.allowed) return jsonOk({ ok: true });

    const body = await readJson<{ email?: unknown; purpose?: unknown }>(request);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const purpose: OtpPurpose =
      body.purpose === "google" || body.purpose === "reset" ? body.purpose : "register";

    const user = email ? findUserByEmail(email) : undefined;
    if (!user) return jsonOk({ ok: true });
    if (purpose !== "reset" && user.email_verified !== 0) return jsonOk({ ok: true });

    const code = issueOtp(user.email, purpose, user.id);
    const subject = purpose === "reset" ? "Kode reset password MyPRD" : "Verifikasi email MyPRD";
    const heading = purpose === "reset" ? "Kode reset password MyPRD kamu:" : "Kode verifikasi MyPRD kamu:";
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
