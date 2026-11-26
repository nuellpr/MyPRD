import { completeChat } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { findProvider, parseModelId, resolveActiveModelId } from "@/lib/env";
import { errorToResponse, jsonOk, readJson } from "@/lib/http";
import { estimateCostUsd } from "@/lib/plans";
import { buildFallbackQuestions, parseQuestionsJson, questionsSystemPrompt } from "@/lib/questions";
import { AI_RATE_LIMIT, rateLimit } from "@/lib/rate-limit";
import { getProject, recordUsage } from "@/lib/repo";
import { sanitizeUserText, wrapUserContent } from "@/lib/safety";

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/:id/questions — buat 5 pertanyaan klarifikasi terstruktur
 * untuk wizard Plan (mengikuti ide awal + preferensi teknologi user).
 */
export async function POST(request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const project = getProject(user.id, id);
    if (!project) return Response.json({ error: "Project tidak ditemukan." }, { status: 404 });

    const limited = rateLimit(`questions:${user.id}`, AI_RATE_LIMIT.limit, AI_RATE_LIMIT.windowMs);
    if (!limited.allowed) {
      return Response.json(
        { error: `Terlalu banyak permintaan. Coba lagi dalam ${limited.retryAfterSec} detik.` },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
      );
    }

    const body = await readJson<{ techPreference?: string; referenceNote?: string }>(request).catch(() => ({} as {
      techPreference?: string;
      referenceNote?: string;
    }));
    const techPref = sanitizeUserText(body.techPreference, 400);
    const refNote = sanitizeUserText(body.referenceNote, 800);
    const language = project.language === "en" ? "en" : "id";

    const userPrompt = [
      `Ide aplikasi: ${project.idea}`,
      techPref ? `Preferensi teknologi: ${techPref}` : "",
      refNote ? `Referensi tambahan: ${refNote}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const activeModelId = resolveActiveModelId(undefined, project.modelId);

    try {
      const { text, usage } = await completeChat({
        modelId: activeModelId,
        messages: [
          { role: "system", content: questionsSystemPrompt(language) },
          { role: "user", content: wrapUserContent(userPrompt) },
        ],
        maxOutputTokens: 1200,
        temperature: 0.4,
      });

      const parsed = parseQuestionsJson(text, project.idea, language);
      const p = parseModelId(activeModelId);
      const provider = p ? findProvider(p.providerId) : undefined;
      recordUsage({
        userId: user.id,
        projectId: project.id,
        kind: "chat",
        provider: usage.provider,
        model: usage.model,
        tokensIn: usage.tokensIn,
        tokensOut: usage.tokensOut,
        costUsd: estimateCostUsd(usage.tokensIn, usage.tokensOut, provider?.costPerMTokIn ?? 0, provider?.costPerMTokOut ?? 0),
      });
      return jsonOk({ questions: parsed });
    } catch {
      return jsonOk({ questions: buildFallbackQuestions(project.idea, language) });
    }
  } catch (error) {
    return errorToResponse(error);
  }
}
