import { requireUser, toPublicUser, updateUserProfile } from "@/lib/auth";
import { defaultModelId, findProvider, isAdminEmail, parseModelId } from "@/lib/env";
import { errorToResponse, jsonError, jsonOk, readJson } from "@/lib/http";
import { sanitizeUserText } from "@/lib/safety";

const AVATAR_DATA_URL_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_AVATAR_CHARS = 200_000;

/** Simpan profil, foto profil, dan preferensi user. */
export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<{
      name?: unknown;
      defaultModelId?: unknown;
      phone?: unknown;
      bio?: unknown;
      avatarUrl?: unknown;
    }>(request);
    const patch: { name?: string; defaultModelId?: string; phone?: string; bio?: string; avatarUrl?: string } = {};

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

    if (body.avatarUrl !== undefined) {
      if (typeof body.avatarUrl !== "string") {
        return jsonError("Format foto profil tidak valid.", 400);
      }
      const trimmed = body.avatarUrl.trim();
      if (trimmed !== "" && (trimmed.length > MAX_AVATAR_CHARS || !AVATAR_DATA_URL_RE.test(trimmed))) {
        return jsonError("Foto harus berformat PNG, JPG, atau WebP (maks. ~150 KB).", 400);
      }
      patch.avatarUrl = trimmed;
    }

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
