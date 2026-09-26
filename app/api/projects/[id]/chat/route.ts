import { requireUser } from "@/lib/auth";
import { StreamStalledError, streamChat } from "@/lib/ai";
import { errorToResponse, SSE_HEADERS, sseEvent, toReadableStream } from "@/lib/http";
import { AI_RATE_LIMIT, rateLimit } from "@/lib/rate-limit";
import { buildMessages, createMarkerFilter, isReadyForPrd, stripMarkers, type Language } from "@/lib/prd";
import { addMessage, getProject, listMessages, recordUsage, touchProject } from "@/lib/repo";
import { estimateCostUsd } from "@/lib/plans";
import { findProvider, parseModelId } from "@/lib/env";
import { MAX_USER_MESSAGE_CHARS, sanitizeUserText, wrapUserContent } from "@/lib/safety";
import { withHeartbeat } from "@/lib/sse-heartbeat";
import type { ChatMessage } from "@/lib/ai";

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/:id/chat — streaming balasan AI (SSE).
 *
 * Event yang dikirim:
 *   {type:"start"} · {type:"delta",text} · {type:"ping"} · {type:"done",...} · {type:"error",message}
 *
 * Event `ping` dikirim berkala saat model belum mengeluarkan token, supaya
 * koneksi tidak diputus saat TTFT panjang.
 */
export async function POST(request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const project = getProject(user.id, id);
    if (!project) return Response.json({ error: "Project tidak ditemukan." }, { status: 404 });

    const limited = rateLimit(`chat:${user.id}`, AI_RATE_LIMIT.limit, AI_RATE_LIMIT.windowMs);
    if (!limited.allowed) {
      return Response.json(
        { error: `Terlalu banyak permintaan. Coba lagi dalam ${limited.retryAfterSec} detik.` },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
      );
    }

    const body = (await request.json().catch(() => ({}))) as { message?: string };
    const text = sanitizeUserText(body.message, MAX_USER_MESSAGE_CHARS);
    if (!text) return Response.json({ error: "Pesan tidak boleh kosong." }, { status: 400 });

    const history = listMessages(project.id).map((m) => ({ role: m.role, content: m.content }) as ChatMessage);
    addMessage(project.id, "user", text);

    // Pesan terakhir dibungkus supaya model memperlakukannya sebagai data.
    const messages: ChatMessage[] = buildMessages({
      language: project.language as Language,
      history: [...history, { role: "user", content: wrapUserContent(text) }],
      mode: "chat",
    });

    const { stream, usage } = streamChat({ modelId: project.modelId, messages, maxOutputTokens: 1500 });

    const encoder = (async function* () {
      yield sseEvent({ type: "start", modelId: project.modelId });
      let output = "";
      let stalled = false;
      // Marker [[SIAP_PRD]] ditahan di server supaya tidak pernah sampai ke UI,
      // termasuk saat terbagi antar chunk.
      const filter = createMarkerFilter();
      try {
        for await (const item of withHeartbeat(stream)) {
          if (item.kind === "ping") {
            yield sseEvent({ type: "ping", at: Date.now() });
            continue;
          }
          const delta = item.value;
          output += delta;
          const visible = filter.push(delta);
          if (visible) yield sseEvent({ type: "delta", text: visible });
        }
        const tail = filter.flush();
        if (tail) yield sseEvent({ type: "delta", text: tail });
      } catch (error) {
        // Provider free tier kadang berhenti di tengah balasan. Kalau sudah ada
        // teks, simpan sebagai pesan parsial supaya percakapan tidak hilang.
        if (error instanceof StreamStalledError && output.trim().length > 0) {
          stalled = true;
          const tail = filter.flush();
          if (tail) yield sseEvent({ type: "delta", text: tail });
        } else {
          const message = error instanceof Error ? error.message : "Gagal menghubungi model AI.";
          yield sseEvent({ type: "error", message });
          return;
        }
      }

      const cleaned = stripMarkers(output);
      const readyForPrd = isReadyForPrd(output);
      const saved = addMessage(project.id, "assistant", cleaned);
      touchProject(project.id);

      const u = await usage;
      const parsed = parseModelId(project.modelId);
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
        messageId: saved.id,
        readyForPrd,
        usage: { tokensIn: u.tokensIn, tokensOut: u.tokensOut },
        ...(stalled
          ? { partial: true, warning: "Koneksi model terputus, jadi balasan ini mungkin belum selesai. Kirim pesan lagi untuk melanjutkan." }
          : {}),
      });
    })();

    return new Response(toReadableStream(encoder), { headers: SSE_HEADERS });
  } catch (error) {
    return errorToResponse(error);
  }
}
