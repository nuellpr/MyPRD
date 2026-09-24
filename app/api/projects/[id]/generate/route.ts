import { requireUser } from "@/lib/auth";
import { streamChat } from "@/lib/ai";
import { findProvider, parseModelId } from "@/lib/env";
import { errorToResponse, SSE_HEADERS, sseEvent, toReadableStream } from "@/lib/http";
import { AI_RATE_LIMIT, rateLimit } from "@/lib/rate-limit";
import { buildMessages, cleanPrdMarkdown, deriveTitleFromPrd, type Language } from "@/lib/prd";
import { estimateCostUsd } from "@/lib/plans";
import { addMessage, getProject, getQuotaState, listMessages, recordUsage, savePrd, touchProject, updateProject } from "@/lib/repo";
import type { ChatMessage } from "@/lib/ai";

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/:id/generate — susun PRD final dari percakapan (SSE).
 *
 * Kuota free tier dicek di sini: satu generate = satu pemakaian kuota.
 * PRD yang dihasilkan langsung disimpan supaya user tidak kehilangan hasil
 * kalau koneksi terputus di tengah streaming.
 */
export async function POST(_request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const project = getProject(user.id, id);
    if (!project) return Response.json({ error: "Project tidak ditemukan." }, { status: 404 });

    const quota = getQuotaState(user.id, user.plan);
    if (!quota.allowed) {
      return Response.json(
        {
          error: `Kuota generate bulan ini sudah habis (${quota.used}/${quota.limit}). Upgrade paket untuk lanjut.`,
          quota,
        },
        { status: 402 },
      );
    }

    const limited = rateLimit(`generate:${user.id}`, AI_RATE_LIMIT.limit, AI_RATE_LIMIT.windowMs);
    if (!limited.allowed) {
      return Response.json(
        { error: `Terlalu banyak permintaan. Coba lagi dalam ${limited.retryAfterSec} detik.` },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
      );
    }

    const history = listMessages(project.id).map((m) => ({ role: m.role, content: m.content }) as ChatMessage);
    const messages: ChatMessage[] = buildMessages({
      language: project.language as Language,
      history,
      idea: project.idea,
      mode: "generate",
    });

    const { stream, usage } = streamChat({ modelId: project.modelId, messages, maxOutputTokens: 6000, temperature: 0.4 });

    const encoder = (async function* () {
      yield sseEvent({ type: "start", modelId: project.modelId, quota });
      let output = "";
      try {
        for await (const delta of stream) {
          output += delta;
          yield sseEvent({ type: "delta", text: delta });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Gagal menghubungi model AI.";
        yield sseEvent({ type: "error", message });
        return;
      }

      const markdown = cleanPrdMarkdown(output);
      const prd = savePrd(project.id, markdown);
      const title = deriveTitleFromPrd(markdown, project.idea || project.title);
      updateProject(user.id, project.id, { title, status: "prd_ready" });
      addMessage(project.id, "assistant", "PRD berhasil disusun. Silakan review di panel PRD.");
      touchProject(project.id);

      const u = await usage;
      const parsed = parseModelId(project.modelId);
      const provider = parsed ? findProvider(parsed.providerId) : undefined;
      recordUsage({
        userId: user.id,
        projectId: project.id,
        kind: "prd",
        provider: u.provider,
        model: u.model,
        tokensIn: u.tokensIn,
        tokensOut: u.tokensOut,
        costUsd: estimateCostUsd(u.tokensIn, u.tokensOut, provider?.costPerMTokIn ?? 0, provider?.costPerMTokOut ?? 0),
      });

      yield sseEvent({
        type: "done",
        prd,
        quota: getQuotaState(user.id, user.plan),
        usage: { tokensIn: u.tokensIn, tokensOut: u.tokensOut },
      });
    })();

    return new Response(toReadableStream(encoder, (chunk) => chunk), { headers: SSE_HEADERS });
  } catch (error) {
    return errorToResponse(error);
  }
}
