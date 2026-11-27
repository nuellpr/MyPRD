import { errorToResponse, jsonError, jsonOk, readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getPrd, savePrd, touchProject, verifyProjectAgentToken } from "@/lib/repo";
import { parseTasks, updateTaskStatusesInPrd, type TaskStatus } from "@/lib/tasks";

type Context = { params: Promise<{ id: string }> };

const VALID_STATUSES = new Set<TaskStatus>(["todo", "in_progress", "done", "failed"]);

/** Webhook untuk AI coding agent melaporkan progres task secara realtime. */
export async function POST(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const rl = rateLimit(`agent-task:${id}:${clientIp(request)}`, 60, 60_000);
    if (!rl.allowed) {
      return Response.json(
        { error: "Terlalu banyak permintaan update task. Coba lagi sebentar." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }

    const auth = request.headers.get("authorization") ?? "";
    const match = auth.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1]?.trim() ?? "";
    if (!verifyProjectAgentToken(id, token)) {
      return jsonError("Token agent tidak valid atau sudah direset.", 401);
    }

    const body = await readJson<{ taskId?: string; taskIds?: unknown; status?: string }>(request);
    const status = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
    if (!VALID_STATUSES.has(status as TaskStatus)) {
      return jsonError("Status harus salah satu dari: todo, in_progress, done, failed.", 400);
    }

    const rawIds: unknown[] = [];
    if (typeof body.taskId === "string") rawIds.push(body.taskId);
    if (Array.isArray(body.taskIds)) rawIds.push(...body.taskIds);

    const normalizedIds = Array.from(
      new Set(
        rawIds
          .filter((v): v is string => typeof v === "string")
          .map((v) => v.trim().toUpperCase())
          .filter((v) => /^T\d+$/.test(v)),
      ),
    ).slice(0, 50);

    if (normalizedIds.length === 0) {
      return jsonError("Sertakan `taskId` (misalnya `T1`) atau `taskIds` yang valid.", 400);
    }

    const prd = getPrd(id);
    if (!prd) {
      return jsonError("PRD project belum dibuat.", 404);
    }

    const existingIds = new Set(parseTasks(prd.content).map((t) => t.id.toUpperCase()));
    const matchedIds = normalizedIds.filter((tid) => existingIds.has(tid));
    if (matchedIds.length === 0) {
      return jsonError("Task tidak ditemukan pada PRD project ini.", 404);
    }

    const nextContent = updateTaskStatusesInPrd(prd.content, matchedIds, status as TaskStatus);
    if (nextContent === prd.content) {
      return jsonOk({ ok: true, projectId: id, version: prd.version, updated: matchedIds, status });
    }

    const saved = savePrd(id, nextContent);
    touchProject(id);
    return jsonOk({ ok: true, projectId: id, version: saved.version, updated: matchedIds, status });
  } catch (error) {
    return errorToResponse(error);
  }
}

export { POST as PATCH };
