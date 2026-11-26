import { requireUser, toPublicUser, updateUserProfile } from "@/lib/auth";
import { defaultModelId, findProvider, isAdminEmail, parseModelId } from "@/lib/env";
import { errorToResponse, jsonError, jsonOk, readJson } from "@/lib/http";
import { sanitizeUserText } from "@/lib/safety";

/** Simpan nama profil dan model AI default user. */
export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<{ name?: unknown; defaultModelId?: unknown; phone?: unknown; bio?: unknown }>(request);
    const patch: { name?: string; defaultModelId?: string; phone?: string; bio?: string } = {};

    if (body.name !== undefined) {
      const name = sanitizeUserText(body.name, 80);
      if (!name) return jsonError("Nama tidak boleh kosong.", 400);
      patch.name = name;
    }

    if (body.defaultModelId !== undefined) {
      const modelId = typeof body.defaultModelId === "string" ? body.defaultModelId.trim() : "";
      const parsed = parseModelId(modelId);
      const provider = parsed ? findProvider(parsed.providerId) : undefined;
      if (!parsed || !provider || !provider.models.includes(parsed.model)) {
        return jsonError("Model AI tidak tersedia. Pilih model lain.", 400);
      }
      patch.defaultModelId = modelId;
    }

    if (body.phone !== undefined) patch.phone = sanitizeUserText(body.phone, 40);
    if (body.bio !== undefined) patch.bio = sanitizeUserText(body.bio, 300);

    if (Object.keys(patch).length === 0) {
      return jsonError("Tidak ada perubahan untuk disimpan.", 400);
    }

    const updated = updateUserProfile(user.id, patch);
    if (!updated) return jsonError("User tidak ditemukan.", 404);

    return jsonOk({
      user: toPublicUser(updated),
      defaultModel: updated.default_model_id || defaultModelId(),
      isAdmin: isAdminEmail(updated.email),
    });
  } catch (error) {
    return errorToResponse(error);
  }
}
