"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GpnLogo, PaymentWalletStrip, QrisBadgeIcon, QrisLogo } from "@/components/billing/PaymentLogos";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { formatDate, formatIdr } from "@/lib/format";
import type { Order } from "@/lib/repo";
import { payWithSnap } from "./snap";

export interface BillingPlanOption {
  id: string;
  name: string;
  priceIdr: number;
  monthlyQuota: number;
  unlimited?: boolean;
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
  createdAt?: number;
  confirmedAt?: number;
  note?: string;
  emailNotified?: boolean;
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
  const [showDetail, setShowDetail] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    if (!qrisModal) return;
    const tick = () => setNowMs(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [qrisModal]);

  function formatCountdown(createdAt?: number): string {
    if (!createdAt || nowMs === null) return "23:59:59";
    const expiresAt = createdAt + 24 * 60 * 60 * 1000;
    const remainSec = Math.max(0, Math.floor((expiresAt - nowMs) / 1000));
    const hrs = String(Math.floor(remainSec / 3600)).padStart(2, "0");
    const mins = String(Math.floor((remainSec % 3600) / 60)).padStart(2, "0");
    const secs = String(remainSec % 60).padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  }

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
        setShowDetail(false);
        setShowGuide(false);
        setQrisModal({
          orderId: String(data.order.id),
          plan: String(data.order.plan),
          amountIdr: Number(data.order.amountIdr),
          baseAmountIdr: Number(data.qris.baseAmountIdr ?? data.order.amountIdr),
          uniqueCode: Number(data.qris.uniqueCode ?? 0),
          payload: String(data.qris.payload),
          qrDataUrl: String(data.qris.qrDataUrl),
          merchant: data.qris.merchant,
          createdAt: typeof data.order.createdAt === "number" ? data.order.createdAt : undefined,
          emailNotified: Boolean(data.emailNotified),
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
      setShowDetail(false);
      setShowGuide(false);
      setQrisModal({
        orderId: String(data.order.id),
        plan: String(data.order.plan),
        amountIdr: Number(data.order.amountIdr),
        baseAmountIdr: Number(data.qris.baseAmountIdr ?? data.order.amountIdr),
        uniqueCode: Number(data.qris.uniqueCode ?? 0),
        payload: String(data.qris.payload),
        qrDataUrl: String(data.qris.qrDataUrl),
        merchant: data.qris.merchant,
        createdAt: typeof data.order.createdAt === "number" ? data.order.createdAt : undefined,
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
              confirmedAt: typeof data.confirmedAt === "number" ? data.confirmedAt : undefined,
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
              <p className="mt-1 text-xs text-slate-400">
                {plan.unlimited ? "PRD tak terbatas/bulan" : `${plan.monthlyQuota} PRD/bulan`}
              </p>
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
                {isCurrent ? (
                  "Paket kamu saat ini"
                ) : busy === plan.id ? (
                  "Memproses..."
                ) : provider === "qris" ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <QrisBadgeIcon className="h-4 w-auto" />
                    <span>Pembayaran via QRIS</span>
                  </span>
                ) : (
                  `Upgrade ke ${plan.name}`
                )}
              </button>
            </StaggerItem>
          );
        })}
      </Stagger>

      {provider === "qris" ? (
        <div className="mt-5 rounded-2xl border border-slate-800/90 bg-[#0b1022]/85 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <QrisLogo variant="dark" className="h-5 w-auto" />
              <span className="text-xs font-medium text-slate-300">Pembayaran via QRIS</span>
            </div>
            <PaymentWalletStrip compact />
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-slate-400">
            Scan menggunakan <strong className="text-slate-200">GoPay, ShopeePay, DANA, OVO, LinkAja</strong> atau
            m-Banking (<strong className="text-slate-200">BCA, Mandiri, BRI, BNI</strong>). Nominal otomatis terisi +
            kode unik 3 digit, dan notifikasi tagihan &amp; aktivasi paket dikirim langsung ke email akunmu.
          </p>
        </div>
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

      {/* Modal Pembayaran via QRIS bergaya Midtrans Snap */}
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
              className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700/80 bg-[#0b1022] shadow-2xl"
            >
              {/* Top Midtrans-style Merchant Header */}
              <div className="bg-linear-to-br from-[#0e1a3a] via-[#102047] to-[#132654] p-4 pb-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/15 bg-white/10">
                      <Image src="/logo-mark.png" alt="MyPRD" width={28} height={24} className="h-5 w-auto" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-white">
                        {qrisModal.merchant.merchantName || "MyPRD Merchant"}
                      </p>
                      <p className="truncate text-[10px] text-sky-200/80">
                        {qrisModal.merchant.nmid ? `NMID ${qrisModal.merchant.nmid}` : "QRIS Indonesia"}
                        {qrisModal.merchant.merchantCity ? ` · ${qrisModal.merchant.merchantCity}` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQrisModal(null)}
                    aria-label="Tutup modal QRIS"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/15 bg-white/5 text-sm text-slate-300 transition hover:bg-white/15 hover:text-white"
                  >
                    ×
                  </button>
                </div>

                {/* Amount + Countdown Strip */}
                <div className="mt-3 rounded-xl border border-white/15 bg-slate-950/55 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Total Tagihan</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span id="qris-modal-title" className="text-xl font-bold tracking-tight text-white">
                          {formatIdr(qrisModal.amountIdr)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(String(qrisModal.amountIdr));
                            setCopiedAmount(true);
                            window.setTimeout(() => setCopiedAmount(false), 1600);
                          }}
                          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-sky-300 transition hover:border-[#35d6ff]"
                        >
                          {copiedAmount ? "Disalin ✓" : "Salin"}
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                        ⏱ {formatCountdown(qrisModal.createdAt)}
                      </span>
                      <p className="mt-1 text-[10px] text-slate-400">Order {qrisModal.orderId}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowDetail((v) => !v)}
                    className="mt-2.5 flex w-full items-center justify-between border-t border-white/10 pt-2 text-[11px] font-medium text-sky-300 transition hover:text-white"
                  >
                    <span>Rincian pesanan · Paket {qrisModal.plan.toUpperCase()}</span>
                    <span>{showDetail ? "Tutup ▲" : "Lihat ▼"}</span>
                  </button>

                  {showDetail ? (
                    <div className="mt-2 space-y-1 border-t border-white/10 pt-2 text-[11px] text-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Harga paket ({qrisModal.plan})</span>
                        <span>{formatIdr(qrisModal.baseAmountIdr)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Kode unik verifikasi</span>
                        <span>+{formatIdr(qrisModal.uniqueCode)}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Body */}
              <div className="p-4 pt-3.5">
                {/* Method Header + E-Wallet Icons */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <QrisLogo variant="dark" className="h-5 w-auto" />
                      <span className="text-xs font-semibold text-white">Pembayaran via QRIS</span>
                    </div>
                    <GpnLogo className="h-5 w-auto" />
                  </div>
                  <div className="mt-2.5 border-t border-slate-800/80 pt-2.5">
                    <PaymentWalletStrip compact />
                  </div>
                </div>

                {/* Official White QRIS Card */}
                <div className="mt-3.5 flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-inner">
                  <div className="flex w-full items-center justify-between pb-2">
                    <QrisLogo variant="light" className="h-5 w-auto" />
                    <GpnLogo className="h-5 w-auto" />
                  </div>

                  <div className="relative mt-1 rounded-xl border border-slate-200 p-2">
                    <div className="pointer-events-none absolute inset-x-3 top-0 z-10 overflow-hidden">
                      <div className="qris-scanline h-0.5 w-full rounded-full bg-linear-to-r from-transparent via-[#0ea5e9] to-transparent shadow-[0_0_8px_#0ea5e9]" />
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrisModal.qrDataUrl}
                      alt={`Pembayaran via QRIS ${formatIdr(qrisModal.amountIdr)}`}
                      width={230}
                      height={230}
                      className="h-56 w-56 rounded-lg"
                    />
                  </div>

                  <p className="mt-2 text-center text-[11px] font-bold text-slate-800">
                    {qrisModal.merchant.merchantName || "MyPRD Merchant"}
                  </p>
                  <p className="mt-0.5 text-center text-[10px] text-slate-500">
                    Nominal {formatIdr(qrisModal.amountIdr)} terisi otomatis saat di-scan
                  </p>
                </div>

                {/* Email Notice */}
                <p className="mt-3 rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-[11px] text-sky-200">
                  ✉️ Notifikasi invoice &amp; status aktivasi paket dikirim ke email akunmu.
                </p>

                {/* Collapsible Guide */}
                <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60">
                  <button
                    type="button"
                    onClick={() => setShowGuide((v) => !v)}
                    className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-slate-200 transition hover:text-white"
                  >
                    <span>Cara pembayaran via QRIS</span>
                    <span className="text-slate-400">{showGuide ? "▲" : "▼"}</span>
                  </button>
                  {showGuide ? (
                    <ol className="space-y-1 border-t border-slate-800 px-3 py-2.5 text-[11px] leading-relaxed text-slate-400">
                      <li>1. Buka aplikasi GoPay, ShopeePay, DANA, OVO, LinkAja, atau m-Banking pilihanmu.</li>
                      <li>2. Pilih menu <strong className="text-slate-200">Scan / Bayar QRIS</strong> lalu arahkan ke kode QR di atas (atau unggah PNG yang diunduh).</li>
                      <li>3. Pastikan nominal sesuai total (<strong className="text-slate-200">{formatIdr(qrisModal.amountIdr)}</strong>) dan konfirmasi bayar.</li>
                      <li>4. Setelah berhasil, klik <strong className="text-slate-200">“Saya Sudah Bayar”</strong> di bawah ini.</li>
                    </ol>
                  ) : null}
                </div>

                {/* Actions */}
                <div className="mt-3.5 space-y-2.5">
                  {qrisModal.confirmedAt ? (
                    <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                      Konfirmasi sudah dikirim pada {formatDate(qrisModal.confirmedAt)}. Admin akan
                      mengaktifkan paket setelah mutasi QRIS diverifikasi dan mengirimkan bukti aktif ke emailmu.
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={qrisNote}
                        onChange={(e) => setQrisNote(e.target.value)}
                        maxLength={120}
                        placeholder="Catatan pengirim (opsional, mis. GoPay / ShopeePay a.n. Budi)"
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
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
