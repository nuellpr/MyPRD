/**
 * Helper respons JSON yang seragam + pemetaan error domain ke HTTP status.
 */
import { AuthError } from "./auth.ts";
import { ModelError } from "./ai.ts";
import { BillingError } from "./billing.ts";
import { OAuthError } from "./oauth.ts";

export function jsonOk<T>(data: T, status = 200): Response {
  return Response.json(data as unknown as Record<string, unknown>, { status });
}

export function jsonError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export function errorToResponse(error: unknown): Response {
  if (error instanceof AuthError) return jsonError(error.message, error.status);
  if (error instanceof ModelError) return jsonError(error.message, error.status);
  if (error instanceof BillingError) return jsonError(error.message, error.status);
  if (error instanceof OAuthError) return jsonError(error.message, error.status);
  const message = error instanceof Error ? error.message : "Terjadi kesalahan tak terduga.";
  console.error("[api]", message);
  return jsonError(message, 500);
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new AuthError("Body request harus JSON yang valid.", 400);
  }
}

/** Ubah stream teks SSE menjadi ReadableStream. */
export function toReadableStream(iterable: AsyncIterable<string>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = iterable[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await iterator.next();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(value));
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });
}

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

export function sseEvent(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}
