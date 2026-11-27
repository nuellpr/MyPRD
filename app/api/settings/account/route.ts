import { clearSessionCookie, requireUser } from "@/lib/auth";
import { verifyPassword } from "@/lib/crypto";
import { errorToResponse, jsonError, jsonOk, readJson } from "@/lib/http";
import { deleteUserAccount } from "@/lib/repo";

/** Hapus permanen akun user beserta project & datanya. */
export async function DELETE(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<{ confirmation?: unknown; password?: unknown }>(request);
    const confirmation = typeof body.confirmation === "string" ? body.confirmation.trim().toUpperCase() : "";
    if (confirmation !== "HAPUS") {
      return jsonError('Ketik "HAPUS" untuk mengonfirmasi penghapusan akun.', 400);
    }

    if (user.password_hash) {
      const password = typeof body.password === "string" ? body.password : "";
      if (!password || !verifyPassword(password, user.password_hash)) {
        return jsonError("Password salah.", 401);
      }
    }

    const deleted = deleteUserAccount(user.id);
    if (!deleted) return jsonError("Akun tidak ditemukan.", 404);
    await clearSessionCookie();
    return jsonOk({ ok: true });
  } catch (error) {
    return errorToResponse(error);
  }
}
