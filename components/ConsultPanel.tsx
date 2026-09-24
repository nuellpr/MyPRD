"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Booking } from "@/lib/repo";

declare global {
  interface Window {
    snap?: { pay: (token: string, callbacks?: Record<string, () => void>) => void };
  }
}

function formatIdr(value: number): string {
  return `Rp${value.toLocaleString("id-ID")}`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_STYLE: Record<string, string> = {
  pending_payment: "bg-amber-500/15 text-amber-300",
  scheduled: "bg-sky-500/15 text-sky-300",
  done: "bg-emerald-500/15 text-emerald-300",
  cancelled: "bg-slate-500/15 text-slate-400",
};

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Menunggu bayar",
  scheduled: "Terjadwal",
  done: "Selesai",
  cancelled: "Dibatalkan",
};

function loadSnapJs(src: string): Promise<void> {
  if (document.querySelector(`script[src="${src}"]`)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Gagal memuat snap.js Midtrans."));
    document.body.appendChild(script);
  });
}

export function ConsultPanel({
  bookings,
  provider,
  snapJsUrl,
  product,
}: {
  bookings: Booking[];
  provider: "mock" | "midtrans";
  snapJsUrl: string;
  product: { name: string; priceIdr: number };
}) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [contact, setContact] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function payWithSnap(token: string) {
    try {
      await loadSnapJs(snapJsUrl);
      window.snap?.pay(token, {
        onSuccess: () => router.refresh(),
        onPending: () => router.refresh(),
        onError: () => setError("Pembayaran gagal. Coba lagi."),
        onClose: () => router.refresh(),
      });
    } catch {
      setError("Gagal memuat popup pembayaran Midtrans.");
    }
  }

  async function submit() {
    if (!topic.trim() || busy !== null) return;
    setBusy("new");
    setError("");
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, contact, preferredDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Booking gagal dibuat.");
        return;
      }
      setTopic("");
      setContact("");
      setPreferredDate("");
      if (data.snapToken) await payWithSnap(data.snapToken);
      router.refresh();
    } catch {
      setError("Koneksi ke server terputus.");
    } finally {
      setBusy(null);
    }
  }

  async function simulatePay(orderId: string) {
    setBusy(orderId);
    setError("");
    try {
      const res = await fetch("/api/billing/mock-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Simulasi gagal.");
        return;
      }
      router.refresh();
    } catch {
      setError("Koneksi ke server terputus.");
    } finally {
      setBusy(null);
    }
  }

  async function cancel(bookingId: string) {
    setBusy(bookingId);
    setError("");
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal membatalkan.");
        return;
      }
      router.refresh();
    } catch {
      setError("Koneksi ke server terputus.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {error ? (
        <p className="no-print mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-lg font-semibold">Booking sesi baru — {formatIdr(product.priceIdr)}/sesi</h2>
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="consult-topic" className="mb-1 block text-sm text-slate-300">
              Topik yang mau dibahas
            </label>
            <textarea
              id="consult-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="mis. Review PRD aplikasi kasir saya sebelum mulai coding…"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="consult-contact" className="mb-1 block text-sm text-slate-300">
                Kontak (WA/email)
              </label>
              <input
                id="consult-contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                maxLength={100}
                placeholder="mis. 0812…"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="consult-date" className="mb-1 block text-sm text-slate-300">
                Jadwal yang diinginkan
              </label>
              <input
                id="consult-date"
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                maxLength={100}
                placeholder="mis. Sabtu pagi"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={!topic.trim() || busy !== null}
            onClick={submit}
            className="rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "new" ? "Memproses..." : `Booking & bayar ${formatIdr(product.priceIdr)}`}
          </button>
          {provider === "mock" ? (
            <p className="text-xs text-slate-500">
              Mode simulasi: selesaikan pembayaran lewat tombol simulasi setelah booking dibuat.
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Booking saya</h2>
        {bookings.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
            Belum ada booking. Isi form di atas untuk menjadwalkan sesi.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {bookings.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{booking.topic}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {booking.id} · {formatDate(booking.createdAt)}
                    {booking.preferredDate ? ` · ingin: ${booking.preferredDate}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs ${STATUS_STYLE[booking.status] ?? ""}`}>
                    {STATUS_LABEL[booking.status] ?? booking.status}
                  </span>
                  {booking.status === "pending_payment" && provider === "mock" && booking.orderId ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => simulatePay(booking.orderId)}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 transition hover:border-slate-500 disabled:opacity-50"
                    >
                      {busy === booking.orderId ? "Memproses..." : "Simulasikan bayar"}
                    </button>
                  ) : null}
                  {booking.status === "pending_payment" ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => cancel(booking.id)}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition hover:border-slate-500 hover:text-slate-200 disabled:opacity-50"
                    >
                      Batalkan
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
