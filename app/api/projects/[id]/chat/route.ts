import { requireUser } from "@/lib/auth";
import { streamChat } from "@/lib/ai";
import { errorToResponse, SSE_HEADERS, sseEvent, toReadableStream } from "@/lib/http";
import { AI_RATE_LIMIT, rateLimit } from "@/lib/rate-limit";
import { buildMessages, isReadyForPrd, stripMarkers, type Language } from "@/lib/prd";
import { addMessage, getProject, listMessages, recordUsage, touchProject } from "@/lib/repo";
import { estimateCostUsd } from "@/lib/plans";
import { findProvider, parseModelId } from "@/lib/env";
import { MAX_USER_MESSAGE_CHARS, sanitizeUserText, wrapUserContent } from "@/lib/safety";
import type { ChatMessage } from "@/lib/ai";

type Context = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/:id/chat — streaming balasan AI (SSE).
 *
 * Event yang dikirim:
 *   {type:"start"} · {type:"delta",text} · {type:"done",...} · {type:"error",message}
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
      });
    })();

    return new Response(toReadableStream(encoder, (chunk) => chunk), { headers: SSE_HEADERS });
  } catch (error) {
    return errorToResponse(error);
  }
}
