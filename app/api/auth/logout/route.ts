import { clearSessionCookie } from "@/lib/auth";
import { errorToResponse, jsonOk } from "@/lib/http";

export async function POST() {
  try {
    await clearSessionCookie();
    return jsonOk({ ok: true });
  } catch (error) {
    return errorToResponse(error);
  }
}
