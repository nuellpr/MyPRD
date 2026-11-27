import { AuthError, authenticate, setPending2faCookie, setSessionCookie, toPublicUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { errorToResponse, jsonError, jsonOk, readJson } from "@/lib/http";
import { assertNotLocked, clearLockout, recordFailedAttempt } from "@/lib/lockout";
import { issueOtp } from "@/lib/otp";
import { AUTH_RATE_LIMIT, clientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const limited = rateLimit(`login:${ip}`, AUTH_RATE_LIMIT.limit, AUTH_RATE_LIMIT.windowMs);
    if (!limited.allowed) {
      return Response.json(
        { error: "Terlalu banyak percobaan login. Coba lagi nanti." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
      );
    }

    const body = await readJson<{ email?: string; password?: string }>(request);
    const email = String(body.email ?? "").trim().toLowerCase();
    const lockKey = email ? `login:${email}` : "";
    if (lockKey) assertNotLocked(lockKey, "Login");

    let user;
    try {
      user = authenticate(email, String(body.password ?? ""));
    } catch (error) {
      if (error instanceof AuthError && error.status === 401 && lockKey) {
        const attempt = recordFailedAttempt(lockKey);
        if (attempt.locked) {
          return jsonError(
            "Percobaan login gagal 5 kali berturut-turut. Akun dikunci selama 24 jam untuk keamanan.",
            429,
          );
        }
        return jsonError(
          `Email atau password salah. Sisa percobaan: ${attempt.remainingAttempts} kali sebelum cooldown 24 jam.`,
          401,
        );
      }
      throw error;
    }

    if (lockKey) clearLockout(lockKey);

    if (user.two_factor_enabled === 1) {
      const code = issueOtp(user.email, "2fa", user.id);
      await sendEmail({
        to: user.email,
        subject: "Kode 2FA masuk MyPRD",
        html: `<p>Kode verifikasi 2FA MyPRD kamu: <strong style="font-size:24px;letter-spacing:6px">${code}</strong></p><p>Berlaku 10 menit. Jangan bagikan kode ini ke siapa pun.</p>`,
      });
      await setPending2faCookie(user.id, user.email);
      const response: { requires2fa: true; email: string; devCode?: string } = {
        requires2fa: true,
        email: user.email,
      };
      if (process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY) {
        response.devCode = code;
      }
      return jsonOk(response);
    }

    await setSessionCookie(user.id);
    return jsonOk({ user: toPublicUser(user) });
  } catch (error) {
    return errorToResponse(error);
  }
}
