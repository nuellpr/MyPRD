/**
 * Aturan paket/langganan & kuota.
 *
 * Upgrade paket lewat /billing (Midtrans Snap, atau simulasi mock untuk lokal);
 * webhook yang terverifikasi mengubah `plan` di tabel users via repo.markOrderPaid.
 */
import { freeMonthlyQuota } from "./env.ts";

export type PlanId = "free" | "starter" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  priceIdr: number;
  /** Kuota generate PRD + task breakdown per bulan. */
  monthlyQuota: number;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceIdr: 0,
    monthlyQuota: freeMonthlyQuota,
    features: [
      "Kuota generate terbatas per bulan",
      "Model AI standar",
      "Export markdown",
      "Akses komunitas Discord",
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceIdr: 49000,
    monthlyQuota: 100,
    features: [
      "Semua model AI standar",
      "Export markdown + PDF",
      "Riwayat project tanpa batas",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceIdr: 149000,
    monthlyQuota: 1000,
    features: [
      "Akses model AI premium",
      "Export markdown + PDF",
      "Priority support",
    ],
  },
};

export function getPlan(planId: string): Plan {
  return PLANS[planId as PlanId] ?? PLANS.free;
}

const PLAN_RANK: Record<PlanId, number> = { free: 0, starter: 1, pro: 2 };

/**
 * True kalau `candidate` boleh menggantikan `current` di kolom `users.plan`.
 *
 * `candidate` harus paket langganan yang benar-benar dikenal — order produk
 * sekali bayar (mis. produk one-off) tidak punya rank dan tidak boleh menyentuh
 * paket sama sekali. Paket saat ini selalu dinormalisasi lewat `getPlan`, jadi
 * data lama dengan plan ngawur tidak membuat user terjebak turun ke free.
 */
export function isPlanUpgrade(current: string, candidate: string): boolean {
  const to = PLAN_RANK[candidate as PlanId];
  if (to === undefined) return false;
  return to >= PLAN_RANK[getPlan(current).id];
}

export interface QuotaState {
  plan: PlanId;
  used: number;
  limit: number;
  remaining: number;
  /** true kalau user masih boleh melakukan operasi yang mengonsumsi kuota. */
  allowed: boolean;
  resetsAt: number;
}

export function evaluateQuota(planId: string, used: number, reference = Date.now()): QuotaState {
  const plan = getPlan(planId);
  const limit = plan.monthlyQuota;
  const remaining = Math.max(0, limit - used);
  const d = new Date(reference);
  return {
    plan: plan.id,
    used,
    limit,
    remaining,
    allowed: remaining > 0,
    resetsAt: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(),
  };
}

/** Estimasi biaya (USD) berdasarkan token — untuk monitoring biaya AI. */
export function estimateCostUsd(tokensIn: number, tokensOut: number, costInPerMTok: number, costOutPerMTok: number): number {
  return (tokensIn / 1_000_000) * costInPerMTok + (tokensOut / 1_000_000) * costOutPerMTok;
}

/** Estimasi token kasar kalau provider tidak mengirim usage (≈4 karakter/token). */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
