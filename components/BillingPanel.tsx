"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { formatDate, formatIdr } from "@/lib/format";
import type { Order } from "@/lib/repo";
import { payWithSnap } from "./snap";

export interface BillingPlanOption {
  id: string;
  name: string;
  priceIdr: number;
  monthlyQuota: number;
  features: string[];
}

export interface QrisModalState {
  orderId: string;
  plan: string;
  amountIdr: number;
  baseAmountIdr: number;
  uniqueCode: number;
  payload: string;
  qrDataUrl: string;
  merchant: {
    merchantName: string;
    merchantCity: string;
    nmid: string;
  };
  confirmedAt?: number;
  note?: string;
}

export interface AdminOrderItem {
  id: string;
  plan: string;
  amountIdr: number;
  status: string;
  provider: string;
  createdAt: number;
  userEmail: string;
  userName: string;
  confirmedAt?: number;
  note?: string;
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

function parseQrisConfirmed(raw: string): number | undefined {
  if (!raw || !raw.startsWith("{")) return undefined;
  try {
    const parsed = JSON.parse(raw) as { confirmedAt?: unknown };
    return typeof parsed.confirmedAt === "number" ? parsed.confirmedAt : undefined;
  } catch {
    return undefined;
  }
}

export function BillingPanel({
  currentPlan,
  orders,
  plans,
  provider,
  snapJsUrl,
  isAdmin = false,
  adminOrders = [],
}: {
  currentPlan: string;
  orders: Order[];
  plans: BillingPlanOption[];
  provider: "mock" | "midtrans" | "mayar" | "qris";
  snapJsUrl: string;
  isAdmin?: boolean;
  adminOrders?: AdminOrderItem[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [qrisModal, setQrisModal] = useState<QrisModalState | null>(null);
  const [qrisNote, setQrisNote] = useState("");
  const [copiedAmount, setCopiedAmount] = useState(false);

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
      if (data.provider === "qris" && data.qris && data.order) {
        setQrisNote("");
        setQrisModal({
          orderId: String(data.order.id),
          plan: String(data.order.plan),
          amountIdr: Number(data.order.amountIdr),
          baseAmountIdr: Number(data.qris.baseAmountIdr ?? data.order.amountIdr),
          uniqueCode: Number(data.qris.uniqueCode ?? 0),
          payload: String(data.qris.payload),
          qrDataUrl: String(data.qris.qrDataUrl),
          merchant: data.qris.merchant,
        });
        router.refresh();
        return;
      }
      if (data.snapToken) {
        await payWithSnap(snapJsUrl, data.snapToken, { onError: setError, onSettled: () => router.refresh() });
      } else if (data.provider === "mayar" && data.redirectUrl) {
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

  async function openQrisOrder(orderId: string) {
    setBusy(orderId);
    setError("");
    try {
      const res = await fetch("/api/billing/qris-detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      });
      const data = await res.json();
      if (!res.ok || !data.qris || !data.order) {
        setError(data.error ?? "Gagal memuat QRIS order.");
        return;
      }
      setQrisNote(String(data.qris.note ?? ""));
      setQrisModal({
        orderId: String(data.order.id),
        plan: String(data.order.plan),
        amountIdr: Number(data.order.amountIdr),
        baseAmountIdr: Number(data.qris.baseAmountIdr ?? data.order.amountIdr),
        uniqueCode: Number(data.qris.uniqueCode ?? 0),
        payload: String(data.qris.payload),
        qrDataUrl: String(data.qris.qrDataUrl),
        merchant: data.qris.merchant,
        confirmedAt: typeof data.qris.confirmedAt === "number" ? data.qris.confirmedAt : undefined,
        note: typeof data.qris.note === "string" ? data.qris.note : undefined,
      });
    } catch {
      setError("Koneksi ke server terputus.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmQrisPaid() {
    if (!qrisModal) return;
    setBusy(qrisModal.orderId);
    setError("");
    try {
      const res = await fetch("/api/billing/qris-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: qrisModal.orderId, note: qrisNote }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal mengirim konfirmasi pembayaran.");
        return;
      }
      setQrisModal((prev) =>
        prev
          ? {
              ...prev,
              confirmedAt: Number(data.confirmedAt ?? Date.now()),
              note: String(data.note ?? qrisNote),
            }
          : null,
      );
      router.refresh();
    } catch {
      setError("Koneksi ke server terputus.");
    } finally {
      setBusy(null);
    }
  }

  async function adminVerifyOrder(orderId: string, action: "approve" | "reject") {
    setBusy(`${orderId}:${action}`);
    setError("");
    try {
      const res = await fetch("/api/billing/admin-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal memproses verifikasi admin.");
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
      <AnimatePresence>
        {error ? (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="no-print mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
          >
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <Stagger inView={false} className="grid gap-5 md:grid-cols-2">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          return (
            <StaggerItem
              key={plan.id}
              className={`card-lift flex flex-col rounded-2xl border p-6 ${
                isCurrent
                  ? "glow-border border-transparent bg-[#0d142a]/85"
                  : "border-slate-800/90 bg-[#0b1022]/80"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">{plan.name}</h2>
                {isCurrent ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Paket aktif
                  </span>
                ) : null}
              </div>
              <p className="mt-3">
                <span className="text-3xl font-bold text-white">{formatIdr(plan.priceIdr)}</span>
                <span className="text-sm text-slate-400">/bulan</span>
              </p>
              <p className="mt-1 text-xs text-slate-400">{plan.monthlyQuota} generate PRD/bulan</p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-300">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="text-[#35d6ff]">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={isCurrent || busy !== null}
                onClick={() => checkout(plan.id)}
                className="btn-shine mt-6 rounded-xl bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCurrent
                  ? "Paket kamu saat ini"
                  : busy === plan.id
                    ? "Memproses..."
                    : provider === "qris"
                      ? `Bayar via QRIS Dinamis`
                      : `Upgrade ke ${plan.name}`}
              </button>
            </StaggerItem>
          );
        })}
      </Stagger>

      {provider === "qris" ? (
        <p className="mt-4 text-xs text-slate-400">
          Pembayaran via <strong className="text-slate-200">QRIS Dinamis</strong>: scan dari GoPay, BCA, Mandiri,
          BNI, BRI, DANA, OVO, atau ShopeePay dengan nominal terkunci otomatis + kode unik 3 digit. Setelah
          transfer, klik <strong className="text-slate-200">“Saya Sudah Bayar”</strong> untuk verifikasi admin.
        </p>
      ) : provider === "mock" ? (
        <p className="mt-4 text-xs text-slate-500">
          Mode simulasi: tanpa merchant key, pembayaran diselesaikan lewat tombol simulasi di riwayat order.
        </p>
      ) : provider === "mayar" ? (
        <p className="mt-4 text-xs text-slate-500">
          Pembayaran via Mayar (QRIS, e-wallet, transfer bank). Setelah bayar tekan{" "}
          <strong className="font-medium text-slate-400">“Saya sudah bayar, cek status”</strong>.
        </p>
      ) : (
        <p className="mt-4 text-xs text-slate-500">
          Pembayaran via Midtrans (QRIS, e-wallet, transfer bank). Webhook server memverifikasi signature sebelum
          upgrade paket.
        </p>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-white">Riwayat order</h2>
        {orders.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
            Belum ada order. Pilih paket di atas untuk upgrade.
          </p>
        ) : (
          <Stagger as="ul" inView={false} className="mt-4 space-y-3">
            {orders.map((order) => {
              const qrisConfirmedAt =
                order.provider === "qris" ? parseQrisConfirmed(order.providerRef) : undefined;
              return (
                <StaggerItem
                  as="li"
                  key={order.id}
                  className="card-lift flex flex-col gap-3 rounded-2xl border border-slate-800/90 bg-[#0b1022]/80 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-white">
                      {order.plan} · {formatIdr(order.amountIdr)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {order.id} · {formatDate(order.createdAt)} · {order.provider.toUpperCase()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        STATUS_STYLE[order.status] ?? STATUS_STYLE.expired
                      }`}
                    >
                      {order.status === "pending" ? (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
                      ) : null}
                      {order.status === "pending" && qrisConfirmedAt
                        ? "Menunggu verifikasi admin"
                        : STATUS_LABEL[order.status] ?? order.status}
                    </span>

                    {order.status === "pending" && order.provider === "qris" ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void openQrisOrder(order.id)}
                        className="rounded-xl border border-[#35d6ff]/50 bg-[#35d6ff]/10 px-3 py-1.5 text-xs font-medium text-[#7fe3ff] transition hover:bg-[#35d6ff]/20 disabled:opacity-50"
                      >
                        {busy === order.id ? "Memuat..." : "Lihat QRIS"}
                      </button>
                    ) : null}

                    {order.status === "pending" && order.provider === "mock" ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => simulatePay(order.id)}
                        className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-200 transition hover:border-[#35d6ff]/60 disabled:opacity-50"
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
                          className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-200 transition hover:border-slate-500 disabled:opacity-50"
                        >
                          Lanjutkan bayar
                        </button>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void checkStatus(order.id)}
                          className="rounded-xl border border-emerald-700/60 px-3 py-1.5 text-xs text-emerald-200 transition hover:border-emerald-500 disabled:opacity-50"
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
                          void payWithSnap(snapJsUrl, order.providerRef, {
                            onError: setError,
                            onSettled: () => router.refresh(),
                          })
                        }
                        className="rounded-xl border border-slate-700 px-3 py-1.5 text-xs text-slate-200 transition hover:border-slate-500 disabled:opacity-50"
                      >
                        Lanjutkan bayar
                      </button>
                    ) : null}
                  </div>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </section>

      {/* Panel Admin Verifikasi QRIS */}
      {isAdmin && adminOrders.length > 0 ? (
        <section className="mt-10 rounded-2xl border border-violet-500/30 bg-[#0d1326]/80 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-white">Verifikasi Pembayaran Masuk (Admin)</h2>
              <p className="text-xs text-slate-400">
                Cocokkan nominal unik pada notifikasi GoPay Merchant lalu setujui untuk mengaktifkan paket.
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2.5">
            {adminOrders.map((ord) => (
              <div
                key={ord.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    {ord.userName || ord.userEmail}{" "}
                    <span className="font-normal text-slate-400">({ord.userEmail})</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-300">
                    Paket <span className="uppercase">{ord.plan}</span> ·{" "}
                    <span className="font-semibold text-[#7fe3ff]">{formatIdr(ord.amountIdr)}</span> ·{" "}
                    {ord.provider.toUpperCase()} · {ord.id}
                  </p>
                  {ord.confirmedAt ? (
                    <p className="mt-1 text-xs text-emerald-300">
                      Pembeli konfirmasi bayar ({formatDate(ord.confirmedAt)})
                      {ord.note ? ` · Catatan: "${ord.note}"` : ""}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      STATUS_STYLE[ord.status] ?? STATUS_STYLE.expired
                    }`}
                  >
                    {STATUS_LABEL[ord.status] ?? ord.status}
                  </span>
                  {ord.status === "pending" ? (
                    <>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void adminVerifyOrder(ord.id, "approve")}
                        className="rounded-lg bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50"
                      >
                        {busy === `${ord.id}:approve` ? "Memproses..." : "Setujui & Aktifkan"}
                      </button>
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void adminVerifyOrder(ord.id, "reject")}
                        className="rounded-lg border border-rose-500/40 px-2.5 py-1.5 text-xs text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-50"
                      >
                        Tolak
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Modal QRIS Dinamis */}
      <AnimatePresence>
        {qrisModal ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="qris-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700/80 bg-[#0b1022] p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#35d6ff]/40 bg-[#35d6ff]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[#7fe3ff]">
                    QRIS Dinamis · Nominal Terkunci
                  </span>
                  <h3 id="qris-modal-title" className="mt-1.5 text-base font-semibold text-white">
                    {qrisModal.merchant.merchantName}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {qrisModal.merchant.nmid ? `NMID: ${qrisModal.merchant.nmid}` : "QRIS Indonesia"}
                    {qrisModal.merchant.merchantCity ? ` · ${qrisModal.merchant.merchantCity}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setQrisModal(null)}
                  aria-label="Tutup modal QRIS"
                  className="rounded-lg border border-slate-800 px-2.5 py-1 text-sm text-slate-400 hover:border-slate-600 hover:text-white"
                >
                  ×
                </button>
              </div>

              {/* QR Image Card */}
              <div className="mt-4 flex flex-col items-center rounded-2xl bg-white p-4 text-slate-900 shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrisModal.qrDataUrl}
                  alt={`QRIS Dinamis ${formatIdr(qrisModal.amountIdr)}`}
                  width={240}
                  height={240}
                  className="h-60 w-60 rounded-lg"
                />
                <p className="mt-2 text-[11px] font-semibold tracking-wide text-slate-600">
                  Order {qrisModal.orderId} · Paket {qrisModal.plan.toUpperCase()}
                </p>
              </div>

              {/* Breakdown Nominal */}
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Harga paket ({qrisModal.plan})</span>
                  <span>{formatIdr(qrisModal.baseAmountIdr)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-slate-400">
                  <span>Kode unik verifikasi</span>
                  <span>+{formatIdr(qrisModal.uniqueCode)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-slate-800 pt-2">
                  <span className="font-semibold text-white">Total Transfer QRIS</span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-[#7fe3ff]">
                      {formatIdr(qrisModal.amountIdr)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(String(qrisModal.amountIdr));
                        setCopiedAmount(true);
                        window.setTimeout(() => setCopiedAmount(false), 1600);
                      }}
                      className="rounded-md border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:border-[#35d6ff]"
                    >
                      {copiedAmount ? "Disalin ✓" : "Salin"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 space-y-2.5">
                {qrisModal.confirmedAt ? (
                  <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                    Konfirmasi sudah dikirim pada {formatDate(qrisModal.confirmedAt)}. Admin akan
                    mengaktifkan paket setelah mutasi QRIS diverifikasi.
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={qrisNote}
                      onChange={(e) => setQrisNote(e.target.value)}
                      maxLength={120}
                      placeholder="Catatan pengirim (opsional, mis. GoPay a.n. Budi)"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-[#35d6ff] focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void confirmQrisPaid()}
                      className="btn-shine w-full rounded-xl bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] py-2.5 text-xs font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50"
                    >
                      {busy === qrisModal.orderId ? "Mengirim..." : "Saya Sudah Bayar"}
                    </button>
                  </>
                )}

                <div className="flex items-center justify-between gap-2 pt-1">
                  <a
                    href={qrisModal.qrDataUrl}
                    download={`qris-${qrisModal.orderId}.png`}
                    className="flex-1 rounded-xl border border-slate-700/80 bg-slate-900/70 py-2 text-center text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
                  >
                    Unduh QRIS (.png)
                  </a>
                  <button
                    type="button"
                    onClick={() => setQrisModal(null)}
                    className="rounded-xl border border-slate-800 px-4 py-2 text-xs text-slate-400 hover:text-white"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
