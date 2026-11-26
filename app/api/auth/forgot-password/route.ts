import { findUserByEmail } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { issueOtp } from "@/lib/otp";
import { errorToResponse, jsonOk, readJson } from "@/lib/http";

const RESET_RATE = { limit: 5, windowMs: 15 * 60 * 1000 };

/** Kirim kode OTP reset. Selalu balas generik agar email tidak bisa dibocorkan. */
export async function POST(request: Request) {
  try {
    const limited = rateLimit(`forgot:${clientIp(request)}`, RESET_RATE.limit, RESET_RATE.windowMs);
    if (!limited.allowed) return jsonOk({ ok: true });
    const body = await readJson<{ email?: unknown }>(request);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const user = email ? findUserByEmail(email) : undefined;
    if (!user) return jsonOk({ ok: true });

    const code = issueOtp(user.email, "reset", user.id);
    try {
      await sendEmail({
        to: user.email,
        subject: "Kode reset password MyPRD",
        html: `<p>Kode reset password MyPRD kamu: <strong style="font-size:24px;letter-spacing:6px">${code}</strong></p><p>Berlaku 10 menit. Jangan bagikan kode ini ke siapa pun.</p>`,
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
