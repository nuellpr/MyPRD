/**
 * Billing: langganan paket berbayar via Midtrans Snap + provider mock.
 *
 * Polanya sama seperti AI router: provider asli (midtrans, butuh merchant key)
 * dan provider `mock` yang selalu tersedia agar alur checkout → upgrade paket
 * bisa dicoba dan dites tanpa kredensial apa pun.
 *
 * Alur Midtrans Snap:
 * 1. POST /api/billing/checkout → order `pending` + Snap token.
 * 2. User membayar lewat Snap popup (snap.js) / redirect_url.
 * 3. Server Midtrans memanggil POST /api/billing/webhook (notifikasi) —
 *    signature_key diverifikasi (SHA512), lalu order jadi `paid` dan
 *    kolom `plan` user di-upgrade. Idempoten: notifikasi ganda aman.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { getPlan } from "./plans.ts";

export type BillingProviderId = "mock" | "midtrans";
export type OrderStatus = "pending" | "paid" | "failed" | "expired";

export class BillingError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "BillingError";
    this.status = status;
  }
}

/** Provider aktif: eksplisit via BILLING_PROVIDER, else midtrans kalau key ada, else mock. */
export function billingProvider(): BillingProviderId {
  const configured = (process.env.BILLING_PROVIDER ?? "").trim().toLowerCase();
  if (configured === "mock") return "mock";
  if (configured === "midtrans") return "midtrans";
  return midtransServerKey() !== "" ? "midtrans" : "mock";
}

export function midtransServerKey(): string {
  return (process.env.MIDTRANS_SERVER_KEY ?? "").trim();
}

/** Client key Midtrans sifatnya publik (dipakai snap.js di browser). */
export function midtransClientKey(): string {
  return (process.env.MIDTRANS_CLIENT_KEY ?? "").trim();
}

export function midtransIsProduction(): boolean {
  return (process.env.MIDTRANS_IS_PRODUCTION ?? "false").trim().toLowerCase() === "true";
}

export function midtransSnapBase(): string {
  return midtransIsProduction() ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com";
}

export function midtransSnapJsUrl(): string {
  return `${midtransSnapBase()}/snap/snap.js`;
}

/** Validasi paket yang boleh dibeli (hanya tier berbayar). */
export function checkoutPlan(planId: string) {
  const plan = getPlan(planId);
  if (plan.id === "free" || plan.priceIdr <= 0) {
    throw new BillingError(`Paket "${planId}" tidak bisa dibeli — paket free memang gratis.`, 400);
  }
  return plan;
}

export interface SnapResult {
  token: string;
  redirectUrl: string;
}

/** Minta Snap token ke Midtrans untuk satu order. */
export async function createSnapTransaction(input: {
  orderId: string;
  amountIdr: number;
  planName: string;
  customerEmail: string;
  customerName: string;
}): Promise<SnapResult> {
  const serverKey = midtransServerKey();
  if (!serverKey) {
    throw new BillingError("MIDTRANS_SERVER_KEY belum diisi — pakai provider mock untuk mencoba alur billing.", 503);
  }
  let res: Response;
  try {
    res = await fetch(`${midtransSnapBase()}/snap/v1/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: "Basic " + Buffer.from(`${serverKey}:`).toString("base64"),
      },
      body: JSON.stringify({
        transaction_details: { order_id: input.orderId, gross_amount: input.amountIdr },
        item_details: [
          {
            id: input.planName.toLowerCase(),
            price: input.amountIdr,
            quantity: 1,
            name: `MyPRD ${input.planName} — langganan 1 bulan`,
          },
        ],
        customer_details: { first_name: input.customerName || input.customerEmail, email: input.customerEmail },
      }),
    });
  } catch {
    throw new BillingError("Tidak bisa menghubungi Midtrans. Coba lagi sebentar lagi.", 502);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new BillingError(`Midtrans menolak transaksi (HTTP ${res.status}). ${body.slice(0, 200)}`, 502);
  }
  const data = (await res.json()) as { token?: string; redirect_url?: string };
  if (!data.token) throw new BillingError("Respons Midtrans tidak berisi Snap token.", 502);
  return { token: data.token, redirectUrl: data.redirect_url ?? "" };
}

/**
 * Verifikasi notifikasi Midtrans: signature_key = SHA512(order_id + status_code
 * + gross_amount + ServerKey), sesuai dokumentasi Midtrans. Nilai status_code
 * dan gross_amount harus string mentah persis seperti yang diterima.
 */
export function verifyMidtransSignature(input: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}): boolean {
  const expected = createHash("sha512")
    .update(`${input.orderId}${input.statusCode}${input.grossAmount}${midtransServerKey()}`)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(input.signatureKey ?? "", "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Petakan transaction_status (+ fraud_status) Midtrans ke status order lokal. */
export function mapMidtransStatus(transactionStatus: string, fraudStatus?: string): OrderStatus {
  if (transactionStatus === "capture") return fraudStatus === "challenge" ? "pending" : "paid";
  if (transactionStatus === "settlement") return "paid";
  if (transactionStatus === "pending") return "pending";
  if (transactionStatus === "expire") return "expired";
  return "failed";
}
