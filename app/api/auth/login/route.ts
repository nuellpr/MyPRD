import { authenticate, setSessionCookie, toPublicUser } from "@/lib/auth";
import { errorToResponse, jsonOk, readJson } from "@/lib/http";
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
    const user = authenticate(String(body.email ?? ""), String(body.password ?? ""));
    await setSessionCookie(user.id);
    return jsonOk({ user: toPublicUser(user) });
  } catch (error) {
    return errorToResponse(error);
  }
}
