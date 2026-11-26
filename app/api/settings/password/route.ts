import { changePassword, requireUser } from "@/lib/auth";
import { errorToResponse, jsonError, jsonOk, readJson } from "@/lib/http";

/** Ganti password untuk user yang sedang login (bukan OAuth). */
export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<{ currentPassword?: unknown; newPassword?: unknown }>(request);
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (!currentPassword || !newPassword) {
      return jsonError("Password lama dan baru wajib diisi.", 400);
    }
    changePassword(user.id, currentPassword, newPassword);
    return jsonOk({ ok: true });
  } catch (error) {
    return errorToResponse(error);
  }
}
