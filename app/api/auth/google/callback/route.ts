import { AuthError, findUserByEmail, setPending2faCookie, setSessionCookie } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { errorToResponse, publicOrigin } from "@/lib/http";
import { assertNotLocked } from "@/lib/lockout";
import { issueOtp, otpLockoutKey } from "@/lib/otp";
import {
  OAuthError,
  exchangeGoogleCode,
  fetchGoogleProfile,
  googleConfigured,
  googleRedirectUri,
  verifyOAuthState,
} from "@/lib/oauth";
import { findOrCreateOAuthUser } from "@/lib/repo";

/** Callback Google: tukar code → profil. Akun baru wajib verifikasi OTP dulu. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = publicOrigin(request);
  const fail = () => Response.redirect(`${origin}/login?oauth=gagal`, 302);
  try {
    if (!googleConfigured() || url.searchParams.get("error")) return fail();
    const verified = verifyOAuthState(url.searchParams.get("state") ?? "");
    const code = url.searchParams.get("code");
    if (!code || !verified) return fail();

    const redirectUri = googleRedirectUri(origin);
    const accessToken = await exchangeGoogleCode(code, redirectUri);
    const profile = await fetchGoogleProfile(accessToken);
    const isNew = !findUserByEmail(profile.email);
    const user = findOrCreateOAuthUser(profile.email, profile.name);

    if (isNew) {
      const otp = issueOtp(user.email, "google", user.id);
      await sendEmail({
        to: user.email,
        subject: "Verifikasi email MyPRD",
        html: `<p>Kode verifikasi MyPRD kamu: <strong style="font-size:24px;letter-spacing:6px">${otp}</strong></p><p>Berlaku 10 menit. Jangan bagikan kode ini ke siapa pun.</p>`,
      });
      const params = new URLSearchParams({ email: user.email, purpose: "google" });
      if (process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY) params.set("devCode", otp);
      return Response.redirect(`${origin}/verifikasi-otp?${params}`, 302);
    }

    if (user.two_factor_enabled === 1) {
      const method = user.two_factor_method === "totp" && user.two_factor_secret_enc ? "totp" : "email";
      let otp: string | undefined;
      try {
        assertNotLocked(otpLockoutKey(user.email, "2fa"), "Verifikasi 2FA");
        if (method === "email") {
          otp = issueOtp(user.email, "2fa", user.id);
        }
      } catch (err) {
        if (err instanceof AuthError && err.status === 429) {
          return Response.redirect(`${origin}/login?oauth=locked`, 302);
        }
        throw err;
      }
      if (method === "email" && otp) {
        await sendEmail({
          to: user.email,
          subject: "Kode 2FA masuk MyPRD",
          html: `<p>Kode verifikasi 2FA MyPRD kamu: <strong style="font-size:24px;letter-spacing:6px">${otp}</strong></p><p>Berlaku 10 menit. Jangan bagikan kode ini ke siapa pun.</p>`,
        });
      }
      await setPending2faCookie(user.id, user.email);
      const params = new URLSearchParams({
        email: user.email,
        purpose: "2fa",
        method,
        next: verified.next,
      });
      if (otp && process.env.NODE_ENV !== "production" && !process.env.RESEND_API_KEY) params.set("devCode", otp);
      return Response.redirect(`${origin}/verifikasi-otp?${params}`, 302);
    }

    await setSessionCookie(user.id);
    return Response.redirect(`${origin}${verified.next}`, 302);
  } catch (error) {
    // Kegagalan OAuth (user batal, code basi, dsb.) → kembali ke login,
    // bukan halaman JSON mentah.
    if (error instanceof OAuthError) return fail();
    return errorToResponse(error);
  }
}
