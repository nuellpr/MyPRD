import { requireUser } from "@/lib/auth";
import { errorToResponse, jsonError, jsonOk, publicUrl } from "@/lib/http";
import { getOrCreateProjectAgentToken, rotateProjectAgentToken } from "@/lib/repo";

type Context = { params: Promise<{ id: string }> };

/** GET token agent per-project (dibuat otomatis saat pertama kali dibuka). */
export async function GET(request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const token = getOrCreateProjectAgentToken(user.id, id);
    if (!token) return jsonError("Project tidak ditemukan.", 404);
    return jsonOk({ token, webhookUrl: publicUrl(request, `/api/projects/${id}/tasks`) });
  } catch (error) {
    return errorToResponse(error);
  }
}

/** POST putar ulang (reset) token agent project; token lama langsung gugur. */
export async function POST(request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const token = rotateProjectAgentToken(user.id, id);
    if (!token) return jsonError("Project tidak ditemukan.", 404);
    return jsonOk({ token, webhookUrl: publicUrl(request, `/api/projects/${id}/tasks`) });
  } catch (error) {
    return errorToResponse(error);
  }
}
