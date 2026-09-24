"use client";

import { useCallback, useState } from "react";

export interface SseHandlers {
  onStart?: (data: Record<string, unknown>) => void;
  onDelta?: (text: string) => void;
  onPing?: () => void;
  onDone?: (data: Record<string, unknown>) => void;
  onError?: (message: string) => void;
}

/** Kalau tidak ada event apa pun (termasuk ping) selama ini, anggap koneksi mati. */
const STALL_TIMEOUT_MS = 60_000;

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
    const controller = new AbortController();
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
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
        // Model bisa diam lama sebelum token pertama: jangan biarkan `read()`
        // menggantung selamanya tanpa kabar (server mengirim `ping` berkala).
        let watchdog: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<"timeout">((resolve) => {
          watchdog = setTimeout(() => resolve("timeout"), STALL_TIMEOUT_MS);
        });
        const read = await Promise.race([reader.read(), timeout]);
        if (watchdog !== undefined) clearTimeout(watchdog);

        if (read === "timeout") {
          succeeded = false;
          controller.abort();
          handlers.onError?.("Model tidak merespons. Coba lagi sebentar lagi.");
          break;
        }

        const { done, value } = read;
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
            case "ping":
              handlers.onPing?.();
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
    } catch (error) {
      if ((error as { name?: string })?.name !== "AbortError") {
        handlers.onError?.("Koneksi ke server terputus.");
      }
      return false;
    } finally {
      setStreaming(false);
    }
  }, []);

  return { post, streaming };
}
