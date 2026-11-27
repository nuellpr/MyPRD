import { jsonError, publicOrigin } from "@/lib/http";
import { googleAuthUrl, googleConfigured, googleRedirectUri, signOAuthState } from "@/lib/oauth";
import { AUTH_RATE_LIMIT, clientIp, rateLimit } from "@/lib/rate-limit";

/** Mulai login Google: redirect ke halaman persetujuan Google. */
export async function GET(request: Request) {
  if (!googleConfigured()) {
    return jsonError("Login Google belum dikonfigurasi di server ini.", 503);
  }
  const ip = clientIp(request);
  const limited = rateLimit(`oauth-google:${ip}`, AUTH_RATE_LIMIT.limit, AUTH_RATE_LIMIT.windowMs);
  if (!limited.allowed) {
    return Response.json(
      { error: "Terlalu banyak percobaan login. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const url = new URL(request.url);
  const origin = publicOrigin(request);
  const next = url.searchParams.get("next") ?? "/dashboard";
  const redirectUri = googleRedirectUri(origin);
  return Response.redirect(googleAuthUrl(signOAuthState(next), redirectUri), 302);
}
