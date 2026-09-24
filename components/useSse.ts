"use client";

import { useCallback, useState } from "react";

export interface SseHandlers {
  onStart?: (data: Record<string, unknown>) => void;
  onDelta?: (text: string) => void;
  onDone?: (data: Record<string, unknown>) => void;
  onError?: (message: string) => void;
}

/**
 * Hook kecil untuk konsumsi endpoint SSE.
 *
 * Dipakai untuk chat & generate PRD: tiap event `data:` diparse lalu
 * diteruskan ke handler sesuai tipe.
 */
export function useSse() {
  const [streaming, setStreaming] = useState(false);

  const post = useCallback(async (url: string, body: unknown, handlers: SseHandlers) => {
    setStreaming(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        handlers.onError?.(data.error ?? `Gagal memproses permintaan (${res.status}).`);
        return false;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let succeeded = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith("data:")) continue;
          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(line.slice(5).trim()) as Record<string, unknown>;
          } catch {
            continue;
          }
          switch (payload.type) {
            case "start":
              handlers.onStart?.(payload);
              break;
            case "delta":
              handlers.onDelta?.(String(payload.text ?? ""));
              break;
            case "done":
              handlers.onDone?.(payload);
              break;
            case "error":
              succeeded = false;
              handlers.onError?.(String(payload.message ?? "Terjadi kesalahan."));
              break;
          }
        }
      }
      return succeeded;
    } catch {
      handlers.onError?.("Koneksi ke server terputus.");
      return false;
    } finally {
      setStreaming(false);
    }
  }, []);

  return { post, streaming };
}
