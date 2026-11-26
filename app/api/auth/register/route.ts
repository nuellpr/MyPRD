import { createUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { issueOtp } from "@/lib/otp";
import { errorToResponse, jsonOk, readJson } from "@/lib/http";
import { AUTH_RATE_LIMIT, clientIp, rateLimit } from "@/lib/rate-limit";
import { sanitizeUserText } from "@/lib/safety";

const otpHtml = (code: string) =>
  `<p>Kode verifikasi MyPRD kamu: <strong style="font-size:24px;letter-spacing:6px">${code}</strong></p><p>Berlaku 10 menit. Jangan bagikan kode ini ke siapa pun.</p>`;

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const limited = rateLimit(`register:${ip}`, AUTH_RATE_LIMIT.limit, AUTH_RATE_LIMIT.windowMs);
    if (!limited.allowed) {
      return Response.json(
        { error: "Terlalu banyak percobaan. Coba lagi nanti." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
      );
    }

    const body = await readJson<{ email?: string; password?: string; name?: string }>(request);
    const user = createUser({
      email: String(body.email ?? ""),
      password: String(body.password ?? ""),
      name: sanitizeUserText(body.name, 80),
    });

    const code = issueOtp(user.email, "register", user.id);
    try {
      await sendEmail({
        to: user.email,
        subject: "Verifikasi email MyPRD",
        html: otpHtml(code),
      });
    } catch (error) {
      getDb().prepare("DELETE FROM users WHERE id = ?").run(user.id);
      throw error;
    }

    const response: { ok: true; email: string; devCode?: string } = { ok: true, email: user.email };
    if (process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY) response.devCode = code;
    return jsonOk(response, 201);
  } catch (error) {
    return errorToResponse(error);
  }
}
