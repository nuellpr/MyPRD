import { setSessionCookie } from "@/lib/auth";
import { errorToResponse } from "@/lib/http";
import {
  OAuthError,
  exchangeGoogleCode,
  fetchGoogleProfile,
  googleConfigured,
  googleRedirectUri,
  verifyOAuthState,
} from "@/lib/oauth";
import { findOrCreateOAuthUser } from "@/lib/repo";

/** Callback Google: tukar code → profil → sesi, lalu redirect ke app. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = () => Response.redirect(`${url.origin}/login?oauth=gagal`, 302);
  try {
    if (!googleConfigured() || url.searchParams.get("error")) return fail();
    const verified = verifyOAuthState(url.searchParams.get("state") ?? "");
    const code = url.searchParams.get("code");
    if (!code || !verified) return fail();

    const redirectUri = googleRedirectUri(url.origin);
    const accessToken = await exchangeGoogleCode(code, redirectUri);
    const profile = await fetchGoogleProfile(accessToken);
    const user = findOrCreateOAuthUser(profile.email, profile.name);
    await setSessionCookie(user.id);
    return Response.redirect(`${url.origin}${verified.next}`, 302);
  } catch (error) {
    // Kegagalan OAuth (user batal, code basi, dsb.) → kembali ke login,
    // bukan halaman JSON mentah.
    if (error instanceof OAuthError) return fail();
    return errorToResponse(error);
  }
}
