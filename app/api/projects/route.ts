import { requireUser } from "@/lib/auth";
import { defaultModelId, findProvider, parseModelId } from "@/lib/env";
import { errorToResponse, jsonOk, readJson } from "@/lib/http";
import { createProject, getQuotaState, listProjects } from "@/lib/repo";
import { MAX_IDEA_CHARS, sanitizeUserText } from "@/lib/safety";

export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk({
      projects: listProjects(user.id),
      quota: getQuotaState(user.id, user.plan),
      defaultModel: defaultModelId(),
    });
  } catch (error) {
    return errorToResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<{ title?: string; idea?: string; modelId?: string; language?: string }>(request);
    const idea = sanitizeUserText(body.idea, MAX_IDEA_CHARS);
    const title = sanitizeUserText(body.title, 120) || idea.split("\n")[0].slice(0, 60) || "Project baru";

    let modelId = sanitizeUserText(body.modelId, 120) || defaultModelId();
    const parsed = parseModelId(modelId);
    if (!parsed || !findProvider(parsed.providerId)) modelId = defaultModelId();

    const language = body.language === "en" ? "en" : "id";
    const project = createProject({ userId: user.id, title, idea, modelId, language });
    return jsonOk({ project }, 201);
  } catch (error) {
    return errorToResponse(error);
  }
}
