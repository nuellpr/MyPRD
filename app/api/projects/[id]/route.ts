import { requireUser } from "@/lib/auth";
import { errorToResponse, jsonOk, readJson } from "@/lib/http";
import { deleteProject, getProject, getQuotaState, getPrd, listMessages, updateProject } from "@/lib/repo";
import { MAX_IDEA_CHARS, sanitizeUserText } from "@/lib/safety";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const project = getProject(user.id, id);
    if (!project) return Response.json({ error: "Project tidak ditemukan." }, { status: 404 });
    return jsonOk({
      project,
      messages: listMessages(project.id),
      prd: getPrd(project.id),
      quota: getQuotaState(user.id, user.plan),
    });
  } catch (error) {
    return errorToResponse(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await readJson<{ title?: string; idea?: string; modelId?: string; language?: string }>(request);
    const patch: Parameters<typeof updateProject>[2] = {};
    if (body.title !== undefined) patch.title = sanitizeUserText(body.title, 120) || "Project baru";
    if (body.idea !== undefined) patch.idea = sanitizeUserText(body.idea, MAX_IDEA_CHARS);
    if (body.modelId !== undefined) patch.modelId = sanitizeUserText(body.modelId, 120);
    if (body.language !== undefined) patch.language = body.language === "en" ? "en" : "id";

    const project = updateProject(user.id, id, patch);
    if (!project) return Response.json({ error: "Project tidak ditemukan." }, { status: 404 });
    return jsonOk({ project });
  } catch (error) {
    return errorToResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const ok = deleteProject(user.id, id);
    if (!ok) return Response.json({ error: "Project tidak ditemukan." }, { status: 404 });
    return jsonOk({ ok: true });
  } catch (error) {
    return errorToResponse(error);
  }
}
