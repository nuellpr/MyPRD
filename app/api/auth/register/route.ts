import { createUser, setSessionCookie, toPublicUser } from "@/lib/auth";
import { errorToResponse, jsonOk, readJson } from "@/lib/http";
import { AUTH_RATE_LIMIT, rateLimit } from "@/lib/rate-limit";
import { sanitizeUserText } from "@/lib/safety";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "local";
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
    await setSessionCookie(user.id);
    return jsonOk({ user: toPublicUser(user) }, 201);
  } catch (error) {
    return errorToResponse(error);
  }
}
