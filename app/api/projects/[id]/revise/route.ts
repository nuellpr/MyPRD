import { StreamStalledError, streamChat } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { findProvider, parseModelId, resolveActiveModelId } from "@/lib/env";
import { errorToResponse, SSE_HEADERS, sseEvent, toReadableStream } from "@/lib/http";
import { estimateCostUsd } from "@/lib/plans";
import { buildReviseMessages, cleanPrdMarkdown, deriveTitleFromPrd, looksLikePrd, type Language } from "@/lib/prd";
import { AI_RATE_LIMIT, rateLimit } from "@/lib/rate-limit";
import { addMessage, getPrd, getProject, recordUsage, savePrd, touchProject, updateProject } from "@/lib/repo";
import { MAX_USER_MESSAGE_CHARS, sanitizeUserText } from "@/lib/safety";
import { withHeartbeat } from "@/lib/sse-heartbeat";

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/:id/revise — revisi PRD & task breakdown lewat Workspace Agent (SSE).
 */
export async function POST(request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const project = getProject(user.id, id);
    if (!project) return Response.json({ error: "Project tidak ditemukan." }, { status: 404 });

    const existingPrd = getPrd(project.id);
    if (!existingPrd) return Response.json({ error: "Belum ada PRD untuk direvisi." }, { status: 400 });

    const limited = rateLimit(`revise:${user.id}`, AI_RATE_LIMIT.limit, AI_RATE_LIMIT.windowMs);
    if (!limited.allowed) {
      return Response.json(
        { error: `Terlalu banyak permintaan. Coba lagi dalam ${limited.retryAfterSec} detik.` },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
      );
    }

    const body = (await request.json().catch(() => ({}))) as { instruction?: string; modelId?: unknown };
    const instruction = sanitizeUserText(body.instruction, MAX_USER_MESSAGE_CHARS);
    if (!instruction) return Response.json({ error: "Instruksi revisi tidak boleh kosong." }, { status: 400 });

    const requestedModel = typeof body.modelId === "string" ? body.modelId : undefined;
    const activeModelId = resolveActiveModelId(requestedModel, project.modelId);
    if (activeModelId !== project.modelId) {
      updateProject(user.id, project.id, { modelId: activeModelId });
    }

    addMessage(project.id, "user", `Revisi PRD: ${instruction}`);

    const messages = buildReviseMessages({
      language: project.language as Language,
      currentPrd: existingPrd.content,
      instruction,
      idea: project.idea,
    });

    const { stream, usage } = streamChat({
      modelId: activeModelId,
      messages,
      maxOutputTokens: 6000,
      temperature: 0.35,
    });

    const encoder = (async function* () {
      yield sseEvent({ type: "start", modelId: activeModelId });
      let output = "";
      let stalled = false;
      try {
        for await (const item of withHeartbeat(stream)) {
          if (item.kind === "ping") {
            yield sseEvent({ type: "ping", at: Date.now() });
            continue;
          }
          output += item.value;
          yield sseEvent({ type: "delta", text: item.value });
        }
      } catch (error) {
        if (error instanceof StreamStalledError && looksLikePrd(cleanPrdMarkdown(output))) {
          stalled = true;
        } else {
          const message = error instanceof Error ? error.message : "Gagal menghubungi model AI.";
          yield sseEvent({ type: "error", message });
          return;
        }
      }

      const markdown = cleanPrdMarkdown(output);
      const prd = looksLikePrd(markdown) ? savePrd(project.id, markdown) : existingPrd;
      const title = deriveTitleFromPrd(prd.content, project.title);
      if (title !== project.title) updateProject(user.id, project.id, { title });
      const savedMsg = addMessage(
        project.id,
        "assistant",
        looksLikePrd(markdown)
          ? "✨ PRD dan daftar task berhasil diperbarui sesuai revisimu."
          : "Maaf, hasil revisi tidak lengkap sehingga PRD sebelumnya tetap dipertahankan. Coba ulangi dengan instruksi lebih singkat.",
      );
      touchProject(project.id);

      const u = await usage;
      const parsed = parseModelId(activeModelId);
      const provider = parsed ? findProvider(parsed.providerId) : undefined;
      recordUsage({
        userId: user.id,
        projectId: project.id,
        kind: "chat",
        provider: u.provider,
        model: u.model,
        tokensIn: u.tokensIn,
        tokensOut: u.tokensOut,
        costUsd: estimateCostUsd(u.tokensIn, u.tokensOut, provider?.costPerMTokIn ?? 0, provider?.costPerMTokOut ?? 0),
      });

      yield sseEvent({
        type: "done",
        prd,
        messageId: savedMsg.id,
        title,
        ...(stalled ? { partial: true, warning: "Koneksi model terputus di tengah revisi." } : {}),
      });
    })();

    return new Response(toReadableStream(encoder), { headers: SSE_HEADERS });
  } catch (error) {
    return errorToResponse(error);
  }
}
