/**
 * Heartbeat untuk stream SSE.
 *
 * Masalah: provider AI bisa butuh puluhan detik sebelum token pertama keluar
 * (TTFT panjang, terutama prompt PRD besar). Selama itu tidak ada byte yang
 * dikirim, sehingga proxy/browser bisa menganggap koneksi mati lalu memutusnya.
 *
 * Solusi: selipkan event `ping` berkala di sela-sela chunk asli. Nilai asli
 * TIDAK pernah hilang karena promise `next()` yang masih menggantung disimpan
 * dan dipakai lagi pada iterasi berikutnya.
 */

export type HeartbeatItem<T> = { kind: "value"; value: T } | { kind: "ping" };

/** Interval ping default (ms). Cukup pendek agar aman di belakang proxy. */
export const SSE_HEARTBEAT_MS = 10_000;

export async function* withHeartbeat<T>(
  source: AsyncIterable<T>,
  intervalMs: number = SSE_HEARTBEAT_MS,
): AsyncGenerator<HeartbeatItem<T>> {
  const iterator = source[Symbol.asyncIterator]();
  let pending: Promise<IteratorResult<T>> | null = null;

  try {
    for (;;) {
      if (!pending) pending = iterator.next();

      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), intervalMs);
      });

      const winner = await Promise.race([
        pending.then((result) => ({ tag: "next" as const, result })),
        timeout.then(() => ({ tag: "timeout" as const })),
      ]);
      if (timer !== undefined) clearTimeout(timer);

      if (winner.tag === "timeout") {
        // Chunk asli masih ditunggu: kirim ping, jangan buang `pending`.
        yield { kind: "ping" };
        continue;
      }

      pending = null;
      if (winner.result.done) return;
      yield { kind: "value", value: winner.result.value };
    }
  } finally {
    await iterator.return?.();
  }
}
