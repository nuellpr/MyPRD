import {
  clearPending2faSetupCookie,
  readPending2faSetupCookie,
  requireUser,
  setPending2faSetupCookie,
  setTwoFactorConfig,
  toPublicUser,
} from "@/lib/auth";
import { verifyPassword } from "@/lib/crypto";
import { sendEmail } from "@/lib/email";
import { errorToResponse, jsonError, jsonOk, readJson } from "@/lib/http";
import { assertNotLocked } from "@/lib/lockout";
import { issueOtp, otpLockoutKey, verifyOtp, verifyTotpAttempt } from "@/lib/otp";
import { buildOtpAuthUri, formatTotpSecret, generateTotpSecret, renderTotpQrDataUrl } from "@/lib/totp";

/** POST: Mulai aktivasi 2FA dengan mengirim kode email atau membuat QR/kunci TOTP. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<{ method?: unknown }>(request);
    const method = body.method === "totp" ? "totp" : body.method === "email" ? "email" : null;
    if (!method) {
      return jsonError('Pilih metode 2FA ("email" atau "totp").', 400);
    }

    assertNotLocked(otpLockoutKey(user.email, "2fa"), "Verifikasi 2FA");

    if (method === "email") {
      await clearPending2faSetupCookie();
      const code = issueOtp(user.email, "2fa", user.id);
      await sendEmail({
        to: user.email,
        subject: "Kode aktivasi 2FA MyPRD",
        html: `<p>Kode verifikasi untuk mengaktifkan 2FA MyPRD kamu: <strong style="font-size:24px;letter-spacing:6px">${code}</strong></p><p>Berlaku 10 menit. Jangan bagikan kode ini ke siapa pun.</p>`,
      });
      const response: { method: "email"; email: string; devCode?: string } = {
        method: "email",
        email: user.email,
      };
      if (process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY) {
        response.devCode = code;
      }
      return jsonOk(response);
    }

    const secret = generateTotpSecret();
    const uri = buildOtpAuthUri(user.email, secret);
    const qrDataUrl = await renderTotpQrDataUrl(uri);
    await setPending2faSetupCookie(user.id, secret);
    return jsonOk({
      method: "totp",
      secret,
      formattedSecret: formatTotpSecret(secret),
      qrDataUrl,
    });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** PATCH: Konfirmasi aktivasi 2FA dengan kode 6 digit, atau nonaktifkan 2FA. */
export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<{ enabled?: unknown; method?: unknown; code?: unknown; password?: unknown }>(request);
    if (typeof body.enabled !== "boolean") {
      return jsonError("Status 2FA harus bernilai true atau false.", 400);
    }

    if (!body.enabled) {
      if (user.password_hash) {
        const password = typeof body.password === "string" ? body.password : "";
        if (!password || !verifyPassword(password, user.password_hash)) {
          return jsonError("Password konfirmasi salah.", 401);
        }
      }
      await clearPending2faSetupCookie();
      const updated = setTwoFactorConfig(user.id, { enabled: false });
      if (!updated) return jsonError("User tidak ditemukan.", 404);
      return jsonOk({ user: toPublicUser(updated) });
    }

    const method = body.method === "totp" ? "totp" : body.method === "email" ? "email" : null;
    if (!method) {
      return jsonError('Metode 2FA harus "email" atau "totp".', 400);
    }
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!/^\d{6}$/.test(code)) {
      return jsonError("Masukkan kode autentikasi 6 digit.", 400);
    }

    let updated;
    if (method === "email") {
      verifyOtp(user.email, "2fa", code);
      updated = setTwoFactorConfig(user.id, { enabled: true, method: "email" });
    } else {
      const setup = await readPending2faSetupCookie();
      if (!setup || setup.userId !== user.id) {
        return jsonError("Sesi setup autentikator kedaluwarsa. Muat ulang QR atau kunci.", 400);
      }
      verifyTotpAttempt(user.email, setup.secret, code);
      updated = setTwoFactorConfig(user.id, { enabled: true, method: "totp", secret: setup.secret });
    }

    await clearPending2faSetupCookie();
    if (!updated) return jsonError("User tidak ditemukan.", 404);
    return jsonOk({ user: toPublicUser(updated) });
  } catch (error) {
    return errorToResponse(error);
  }
}
