"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Order } from "@/lib/repo";
import { formatDate, formatIdr } from "@/lib/format";
import { payWithSnap } from "./snap";

export interface BillingPlanOption {
  id: string;
  name: string;
  priceIdr: number;
  monthlyQuota: number;
  features: string[];
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300",
  paid: "bg-emerald-500/15 text-emerald-300",
  failed: "bg-red-500/15 text-red-300",
  expired: "bg-slate-500/15 text-slate-400",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu bayar",
  paid: "Lunas",
  failed: "Gagal",
  expired: "Kedaluwarsa",
};

export function BillingPanel({
  currentPlan,
  orders,
  plans,
  provider,
  snapJsUrl,
}: {
  currentPlan: string;
  orders: Order[];
  plans: BillingPlanOption[];
  provider: "mock" | "midtrans" | "mayar";
  snapJsUrl: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function checkout(planId: string) {
    setBusy(planId);
    setError("");
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Checkout gagal.");
        return;
      }
      if (data.snapToken) {
        await payWithSnap(snapJsUrl, data.snapToken, { onError: setError, onSettled: () => router.refresh() });
      } else if (data.provider === "mayar" && data.redirectUrl) {
        // Mayar tidak punya popup SDK — user diarahkan ke halaman bayarnya.
        window.location.assign(data.redirectUrl);
        return;
      }
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

  /** Satu endpoint untuk dua kebutuhan: link pembayaran + status sebenarnya. */
  async function mayarLookup(orderId: string): Promise<{ status: string; link: string }> {
    const res = await fetch("/api/billing/check-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Permintaan gagal.");
    return { status: String(data.status ?? ""), link: String(data.link ?? "") };
  }

  /**
   * Mayar hanya menerima satu urlHook per akun merchant, jadi MyPRD tidak bisa
   * mengandalkan webhook. Dua tombol ini menutup alurnya: buka link pembayaran,
   * lalu setelah membayar tanya statusnya langsung ke API Mayar.
   */
  async function continuePay(orderId: string) {
    setBusy(orderId);
    setError("");
    try {
      const { link } = await mayarLookup(orderId);
      if (link) window.location.assign(link);
      else setError("Link pembayaran tidak tersedia. Buat order baru ya.");
    } catch {
      setError("Gagal membuka link pembayaran.");
    } finally {
      setBusy(null);
    }
  }

  async function checkStatus(orderId: string) {
    setBusy(orderId);
    setError("");
    try {
      const { status } = await mayarLookup(orderId);
      if (status === "paid") {
        router.refresh();
        return;
      }
      setError(
        status === "closed"
          ? "Pembayaran ini sudah ditutup di Mayar. Buat order baru ya."
          : "Pembayaran belum terdeteksi di Mayar. Tunggu 1-2 menit setelah bayar, lalu coba lagi.",
      );
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

      <section className="grid gap-5 md:grid-cols-2">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          return (
            <div key={plan.id} className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                {isCurrent ? (
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
                    Paket aktif
                  </span>
                ) : null}
              </div>
              <p className="mt-3">
                <span className="text-3xl font-bold">{formatIdr(plan.priceIdr)}</span>
                <span className="text-sm text-slate-400">/bulan</span>
              </p>
              <p className="mt-1 text-xs text-slate-400">{plan.monthlyQuota} generate PRD/bulan</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-300">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="text-sky-400">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={isCurrent || busy !== null}
                onClick={() => checkout(plan.id)}
                className="mt-6 rounded-lg bg-linear-to-r from-sky-500 to-violet-400 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCurrent ? "Paket kamu saat ini" : busy === plan.id ? "Memproses..." : `Upgrade ke ${plan.name}`}
              </button>
            </div>
          );
        })}
      </section>

      {provider === "mock" ? (
        <p className="mt-4 text-xs text-slate-500">
          Mode simulasi: tanpa merchant key, pembayaran diselesaikan lewat tombol simulasi di riwayat order.
        </p>
      ) : provider === "mayar" ? (
        <p className="mt-4 text-xs text-slate-500">
          Pembayaran via Mayar (QRIS, e-wallet, transfer bank). Mayar hanya menerima satu webhook per akun
          merchant, jadi setelah bayar tekan{" "}
          <strong className="font-medium text-slate-400">“Saya sudah bayar, cek status”</strong> — server
          menanyakan langsung ke API Mayar sebelum paket di-upgrade.
        </p>
      ) : (
        <p className="mt-4 text-xs text-slate-500">
          Pembayaran via Midtrans (QRIS, e-wallet, transfer bank). Webhook server memverifikasi signature sebelum upgrade paket.
        </p>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Riwayat order</h2>
        {orders.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
            Belum ada order. Pilih paket di atas untuk upgrade.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {orders.map((order) => (
              <li
                key={order.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {order.plan} · {formatIdr(order.amountIdr)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {order.id} · {formatDate(order.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs ${STATUS_STYLE[order.status] ?? STATUS_STYLE.expired}`}
                  >
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                  {order.status === "pending" && order.provider === "mock" ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => simulatePay(order.id)}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 transition hover:border-slate-500 disabled:opacity-50"
                    >
                      {busy === order.id ? "Memproses..." : "Simulasikan bayar"}
                    </button>
                  ) : null}
                  {order.status === "pending" && order.provider === "mayar" && order.providerRef ? (
                    <>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void continuePay(order.id)}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 transition hover:border-slate-500 disabled:opacity-50"
                      >
                        Lanjutkan bayar
                      </button>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void checkStatus(order.id)}
                        className="rounded-lg border border-emerald-700/60 px-3 py-1.5 text-xs text-emerald-200 transition hover:border-emerald-500 disabled:opacity-50"
                      >
                        {busy === order.id ? "Mengecek..." : "Saya sudah bayar, cek status"}
                      </button>
                    </>
                  ) : null}
                  {order.status === "pending" && order.provider === "midtrans" && order.providerRef ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() =>
                        void payWithSnap(snapJsUrl, order.providerRef, { onError: setError, onSettled: () => router.refresh() })
                      }
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 transition hover:border-slate-500 disabled:opacity-50"
                    >
                      Lanjutkan bayar
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
