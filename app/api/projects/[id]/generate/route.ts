import { requireUser } from "@/lib/auth";
import { StreamStalledError, streamChat } from "@/lib/ai";
import { findProvider, parseModelId, resolveActiveModelId } from "@/lib/env";
import { errorToResponse, SSE_HEADERS, sseEvent, toReadableStream } from "@/lib/http";
import { AI_RATE_LIMIT, rateLimit } from "@/lib/rate-limit";
import { buildMessages, cleanPrdMarkdown, deriveTitleFromPrd, looksLikePrd, type Language } from "@/lib/prd";
import { estimateCostUsd } from "@/lib/plans";
import { addMessage, finalizeUsage, getProject, getQuotaState, listMessages, releaseUsage, reserveUsage, savePrd, touchProject, updateProject } from "@/lib/repo";
import { MAX_USER_MESSAGE_CHARS, sanitizeUserText } from "@/lib/safety";
import { withHeartbeat } from "@/lib/sse-heartbeat";
import type { ChatMessage } from "@/lib/ai";

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/:id/generate — susun PRD final dari percakapan (SSE).
 *
 * Kuota free tier dicek & direservasi di sini: satu generate = satu pemakaian kuota.
 * PRD yang dihasilkan langsung disimpan supaya user tidak kehilangan hasil
 * kalau koneksi terputus di tengah streaming.
 */
export async function POST(request: Request, { params }: Context) {
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

    const bodyJson = (await request.json().catch(() => ({}))) as { wizardContext?: unknown; modelId?: unknown };
    const requestedModel = typeof bodyJson.modelId === "string" ? bodyJson.modelId : undefined;
    const activeModelId = resolveActiveModelId(requestedModel, project.modelId);
    if (activeModelId !== project.modelId) {
      updateProject(user.id, project.id, { modelId: activeModelId });
    }
    const wizardContext = sanitizeUserText(bodyJson.wizardContext, MAX_USER_MESSAGE_CHARS);
    if (wizardContext) {
      addMessage(project.id, "user", wizardContext);
    }

    const history = listMessages(project.id).map((m) => ({ role: m.role, content: m.content }) as ChatMessage);
    const messages: ChatMessage[] = buildMessages({
      language: project.language as Language,
      history,
      idea: project.idea,
      mode: "generate",
    });

    const { stream, usage } = streamChat({ modelId: activeModelId, messages, maxOutputTokens: 6000, temperature: 0.4 });

    // Reservasi kuota sebelum streaming: satu tick sinkron dengan cek kuota di
    // atas, jadi dua permintaan paralel tidak bisa sama-sama lolos.
    const usageId = reserveUsage({ userId: user.id, projectId: project.id, kind: "prd" });
    let usageFinalized = false;

    const body = (async function* () {
      yield sseEvent({ type: "start", modelId: activeModelId, quota: getQuotaState(user.id, user.plan) });
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
        // Provider free tier kadang berhenti di tengah stream. Kalau teks yang
        // sudah diterima sudah berbentuk PRD, simpan sebagai draf parsial
        // daripada membuang semuanya (user bisa Generate ulang untuk melengkapi).
        if (error instanceof StreamStalledError && looksLikePrd(cleanPrdMarkdown(output))) {
          stalled = true;
        } else {
          const message = error instanceof Error ? error.message : "Gagal menghubungi model AI.";
          yield sseEvent({ type: "error", message });
          return;
        }
      }

      const markdown = cleanPrdMarkdown(output);
      const prd = savePrd(project.id, markdown);
      const title = deriveTitleFromPrd(markdown, project.idea || project.title);
      updateProject(user.id, project.id, { title, status: "prd_ready" });
      addMessage(
        project.id,
        "assistant",
        stalled
          ? "PRD tersimpan sebagian (koneksi model terputus di tengah proses). Silakan review, lalu tekan Generate PRD lagi untuk melengkapi."
          : "PRD berhasil disusun. Silakan review di panel PRD.",
      );
      touchProject(project.id);

      const u = await usage;
      const parsed = parseModelId(activeModelId);
      const provider = parsed ? findProvider(parsed.providerId) : undefined;
      finalizeUsage(usageId, {
        provider: u.provider,
        model: u.model,
        tokensIn: u.tokensIn,
        tokensOut: u.tokensOut,
        costUsd: estimateCostUsd(u.tokensIn, u.tokensOut, provider?.costPerMTokIn ?? 0, provider?.costPerMTokOut ?? 0),
      });
      usageFinalized = true;

      yield sseEvent({
        type: "done",
        prd,
        quota: getQuotaState(user.id, user.plan),
        usage: { tokensIn: u.tokensIn, tokensOut: u.tokensOut },
        ...(stalled
          ? { partial: true, warning: "Model berhenti di tengah proses, jadi PRD ini mungkin belum lengkap. Tekan Generate PRD lagi untuk menyelesaikannya." }
          : {}),
      });
    })();

    // Pembungkus: kalau klien putus di tengah stream, `body` ditutup dan
    // reservasi kuota dibatalkan supaya user tidak terpotong tanpa hasil.
    const encoder = (async function* () {
      try {
        yield* body;
      } finally {
        if (!usageFinalized) releaseUsage(usageId);
      }
    })();

    return new Response(toReadableStream(encoder), { headers: SSE_HEADERS });
  } catch (error) {
    return errorToResponse(error);
  }
}
