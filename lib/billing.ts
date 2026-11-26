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
 *
 * Mayar (API V2 — V1 dimatikan 1 Okt 2026) memakai Single Payment Request:
 * 1. POST /hl/v2/payments/create dengan extraData.myprdOrderId = order id lokal.
 * 2. User membayar lewat `link` halaman pembayaran Mayar.
 * 3. Mayar POST /api/billing/webhook dengan event `payment.received`. Webhook
 *    Mayar TIDAK ditandatangani, jadi satu-satunya sumber kebenaran adalah
 *    requery GET /hl/v2/payments/{id} memakai API key kita sendiri: kalau
 *    statusnya bukan `paid`, webhook yang datang (dipalsukan atau tidak) diabaikan.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { getPlan } from "./plans.ts";

export type BillingProviderId = "mock" | "midtrans" | "mayar";
export type OrderStatus = "pending" | "paid" | "failed" | "expired";

export class BillingError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "BillingError";
    this.status = status;
  }
}

/**
 * Provider aktif.
 *
 * Midtrans: otomatis aktif kalau MIDTRANS_SERVER_KEY terisi (perilaku lama).
 * Mayar: HARUS dipilih eksplisit lewat BILLING_PROVIDER=mayar. Auto-detect dari
 * keberadaan API key sengaja tidak dipakai — webhook Mayar tidak ditandatangani
 * dan user langsung dikirim ke halaman bayar, jadi jangan sampai ada transaksi
 * nyata yang tidak sengaja terpicu hanya karena sebuah key menyala di
 * environment. Set BILLING_PROVIDER=mock juga untuk mengunci mode simulasi.
 */
export function billingProvider(): BillingProviderId {
  const configured = (process.env.BILLING_PROVIDER ?? "").trim().toLowerCase();
  if (configured === "mock" || configured === "midtrans" || configured === "mayar") return configured;
  if (midtransServerKey() !== "") return "midtrans";
  return "mock";
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
  /** Nama item di dashboard Midtrans (default: langganan 1 bulan). */
  itemName?: string;
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
            name: input.itemName ?? `MyPRD ${input.planName} — langganan 1 bulan`,
          },
        ],
        customer_details: { first_name: input.customerName || input.customerEmail, email: input.customerEmail },
      }),
    });
  } catch {
    throw new BillingError("Tidak bisa menghubungi Midtrans. Coba lagi sebentar lagi.", 502);
  }
  if (!res.ok) {
    // Body Midtrans hanya untuk log server — isinya bisa memuat detail
    // internal gateway yang tidak boleh muncul di respons ke user.
    const body = await res.text().catch(() => "");
    console.error("[midtrans]", res.status, body.slice(0, 500));
    throw new BillingError(`Midtrans menolak transaksi (HTTP ${res.status}). Coba lagi sebentar lagi.`, 502);
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

// ---------------------------------------------------------------------------
// Mayar (Single Payment Request, API V2)
// ---------------------------------------------------------------------------

export function mayarApiKey(): string {
  return (process.env.MAYAR_API_KEY ?? "").trim();
}

export function mayarIsProduction(): boolean {
  return (process.env.MAYAR_IS_PRODUCTION ?? "false").trim().toLowerCase() === "true";
}

/** Host API V2 Mayar. Host V1 dimatikan 1 Oktober 2026 — jangan dipakai lagi. */
export function mayarApiBase(): string {
  return mayarIsProduction() ? "https://api.mayar.id/hl/v2" : "https://api.mayar.io/hl/v2";
}

export interface MayarPaymentRequest {
  /** Id payment request Mayar — dipakai saat requery verifikasi webhook. */
  id: string;
  /** Halaman pembayaran publik milik Mayar. */
  link: string;
}

/** Nama key di `extraData`; Mayar mengirim ulang objek ini apa adanya di webhook. */
export const MAYAR_ORDER_KEY = "myprdOrderId";

type MayarEnvelope = {
  statusCode?: number;
  messages?: unknown;
  message?: unknown;
  data?: unknown;
};

/** `messages` bisa string, `message` tunggal, atau array {property, message}. */
function mayarErrorText(payload: MayarEnvelope): string {
  const raw = payload.messages ?? payload.message;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === "string") return item;
        const entry = item as { property?: string; message?: string };
        return `${entry.property ?? ""} ${entry.message ?? ""}`.trim();
      })
      .filter(Boolean)
      .join("; ");
  }
  return "";
}

/**
 * Buat Single Payment Request di Mayar lalu kembalikan link pembayarannya.
 *
 * `orderId` lokal disimpan di `extraData` — itu satu-satunya kunci korelasi
 * karena webhook Mayar tidak ditandatangani dan tidak memuat id order kita.
 */
export async function createMayarPaymentRequest(input: {
  orderId: string;
  amountIdr: number;
  description: string;
  customerEmail: string;
  customerName: string;
  customerMobile?: string;
  /** Halaman tujuan setelah bayar; Mayar kadang menolak field ini, lalu dicoba tanpa. */
  redirectUrl?: string;
  /** Masa berlaku bayar, ISO 8601. Default 24 jam. */
  expiredAt?: string;
}): Promise<MayarPaymentRequest> {
  const apiKey = mayarApiKey();
  if (!apiKey) {
    throw new BillingError("MAYAR_API_KEY belum diisi — pakai provider mock untuk mencoba alur billing.", 503);
  }

  const base: Record<string, unknown> = {
    name: input.customerName || input.customerEmail,
    amount: input.amountIdr,
    email: input.customerEmail,
    description: input.description,
    expiredAt: input.expiredAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    extraData: { [MAYAR_ORDER_KEY]: input.orderId },
  };
  if (input.customerMobile) base.mobile = input.customerMobile;

  // Mayar menolak redirectUrl pada payment request dengan pesan 400 spesifik.
  // Coba ulang tanpa field itu daripada gagalkan seluruh checkout.
  const attempts = input.redirectUrl ? [{ ...base, redirectUrl: input.redirectUrl }, base] : [base];

  for (const payload of attempts) {
    let res: Response;
    try {
      res = await fetch(`${mayarApiBase()}/payments/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new BillingError("Tidak bisa menghubungi Mayar. Coba lagi sebentar lagi.", 502);
    }
    const body = (await res.json().catch(() => ({}))) as MayarEnvelope;
    const message = mayarErrorText(body);

    // `statusCode` di dalam body yang otoritatif: sebagian endpoint Mayar
    // membalas HTTP 200 walau operasinya ditolak.
    const ok = res.ok && (typeof body.statusCode !== "number" || body.statusCode < 400);
    if (ok) {
      const data = (body.data ?? {}) as { id?: string; link?: string; linkUrl?: string };
      const link = data.link ?? data.linkUrl ?? "";
      if (!data.id || !link) {
        console.error("[mayar] payments/create tanpa id/link", JSON.stringify(body).slice(0, 500));
        throw new BillingError("Respons Mayar tidak berisi link pembayaran.", 502);
      }
      return { id: data.id, link };
    }

    // Body respons hanya untuk log server — bisa memuat detail internal gateway.
    console.error("[mayar] payments/create", res.status, body.statusCode, message.slice(0, 500));
    if (res.status === 429) {
      throw new BillingError("Terlalu banyak permintaan ke Mayar. Tunggu 1 menit lalu coba lagi.", 429);
    }
    if (!/redirecturl/i.test(message)) break;
  }

  throw new BillingError("Mayar menolak permintaan pembayaran. Coba lagi sebentar lagi.", 502);
}

/** Hasil requery satu payment request Mayar. */
export interface MayarPaymentState {
  /** `paid` adalah satu-satunya sinyal lunas. */
  status: "unpaid" | "paid" | "closed";
  /** Halaman pembayaran publik; `""` kalau Mayar tidak mengirimkannya. */
  link: string;
  amount: number;
}

/**
 * Requery satu payment request Mayar. Satu panggilan ini melayani dua pemakai:
 * verifikasi webhook (butuh `status`) dan tombol "cek status" di /billing
 * (butuh `status` + `link`), jadi tidak perlu dua round-trip.
 */
export async function mayarPaymentRequest(paymentId: string): Promise<MayarPaymentState> {
  const apiKey = mayarApiKey();
  if (!apiKey) throw new BillingError("MAYAR_API_KEY belum diisi.", 503);
  let res: Response;
  try {
    res = await fetch(`${mayarApiBase()}/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
    });
  } catch {
    throw new BillingError("Tidak bisa menghubungi Mayar. Coba lagi sebentar lagi.", 502);
  }
  if (!res.ok) {
    console.error("[mayar] payments/", paymentId, res.status);
    throw new BillingError(`Mayar menolak pembacaan status (HTTP ${res.status}).`, 502);
  }
  const body = (await res.json().catch(() => ({}))) as {
    data?: { status?: string; amount?: number; linkUrl?: string; linkPayment?: string };
  };
  const status = String(body.data?.status ?? "").toLowerCase();
  if (status !== "paid" && status !== "unpaid" && status !== "closed") {
    console.error("[mayar] status tak dikenal", paymentId, status);
    throw new BillingError("Status pembayaran dari Mayar tidak dikenali.", 502);
  }
  return {
    status,
    link: body.data?.linkPayment ?? body.data?.linkUrl ?? "",
    amount: Number(body.data?.amount ?? 0),
  };
}
