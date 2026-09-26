/**
 * Helper pembayaran Midtrans Snap untuk client component.
 *
 * `snap.js` dimuat sekali saja (idempoten) lalu popup dibuka; hasil pembayaran
 * dilaporkan lewat callback supaya komponen bisa menyegarkan data.
 */

declare global {
  interface Window {
    snap?: { pay: (token: string, callbacks?: Record<string, () => void>) => void };
  }
}

export function loadSnapJs(src: string): Promise<void> {
  if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Gagal memuat snap.js Midtrans."));
    document.body.appendChild(script);
  });
}

export async function payWithSnap(
  snapJsUrl: string,
  token: string,
  handlers: { onError: (message: string) => void; onSettled: () => void },
): Promise<void> {
  try {
    await loadSnapJs(snapJsUrl);
    window.snap?.pay(token, {
      onSuccess: handlers.onSettled,
      onPending: handlers.onSettled,
      onError: () => handlers.onError("Pembayaran gagal. Coba lagi."),
      onClose: handlers.onSettled,
    });
  } catch {
    handlers.onError("Gagal memuat popup pembayaran Midtrans.");
  }
}
