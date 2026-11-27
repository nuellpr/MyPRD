import { requireUser, setTwoFactorEnabled, toPublicUser } from "@/lib/auth";
import { verifyPassword } from "@/lib/crypto";
import { errorToResponse, jsonError, jsonOk, readJson } from "@/lib/http";

/** Aktifkan atau nonaktifkan autentikasi dua faktor (2FA) via OTP email. */
export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<{ enabled?: unknown; password?: unknown }>(request);
    if (typeof body.enabled !== "boolean") {
      return jsonError("Status 2FA harus bernilai true atau false.", 400);
    }

    if (!body.enabled && user.password_hash) {
      const password = typeof body.password === "string" ? body.password : "";
      if (!password || !verifyPassword(password, user.password_hash)) {
        return jsonError("Password konfirmasi salah.", 401);
      }
    }

    const updated = setTwoFactorEnabled(user.id, body.enabled);
    if (!updated) return jsonError("User tidak ditemukan.", 404);
    return jsonOk({ user: toPublicUser(updated) });
  } catch (error) {
    return errorToResponse(error);
  }
}
