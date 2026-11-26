import { findUserById } from "@/lib/auth";
import { mapMidtransStatus, mayarPaymentRequest, MAYAR_ORDER_KEY, verifyMidtransSignature } from "@/lib/billing";
import { sendPaymentSuccessEmail } from "@/lib/billing-email";
import { errorToResponse, jsonError, jsonOk, readJson } from "@/lib/http";
import { getOrderById, markOrderPaid, setOrderStatus } from "@/lib/repo";

/**
 * Webhook notifikasi pembayaran (tanpa auth sesi — dipanggil server gateway).
 * Dispatch berdasarkan bentuk payload: Midtrans mengirim field datar, Mayar
 * mengirim `{ event, data }`.
 *
 * Midtrans: signature_key SHA512 diverifikasi dulu.
 * Mayar: TIDAK ada tanda tangan sama sekali, jadi `payment.received` hanya
 * dipercaya setelah requery ke API Mayar dengan API key kita sendiri. Order
 * dihitung lunas hanya bila status Mayar `paid` DAN amount-nya cocok.
 *
 * Untuk lokal: daftarkan URL publik (mis. via ngrok) di dashboard gateway.
 * Tanpa itu, pakai provider mock.
 */
export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    const dashboardUrl = new URL("/dashboard", request.url).toString();
    if (typeof body.event === "string" && body.data && typeof body.data === "object") {
      return await handleMayar(body.event, body.data as Record<string, unknown>, dashboardUrl);
    }
    return await handleMidtrans(body, dashboardUrl);
  } catch (error) {
    return errorToResponse(error);
  }
}

async function handleMidtrans(body: Record<string, unknown>, dashboardUrl: string) {
  const orderId = String(body.order_id ?? "");
  const statusCode = String(body.status_code ?? "");
  const grossAmount = String(body.gross_amount ?? "");
  const signatureKey = String(body.signature_key ?? "");
  if (!orderId || !verifyMidtransSignature({ orderId, statusCode, grossAmount, signatureKey })) {
    return jsonError("Signature webhook tidak valid.", 401);
  }
  const order = getOrderById(orderId);
  if (!order) return jsonError("Order tidak ditemukan.", 404);
  const next = mapMidtransStatus(String(body.transaction_status ?? ""), String(body.fraud_status ?? ""));
  if (next === "paid") {
    const result = markOrderPaid(orderId);
    if (result && !result.alreadyPaid) {
      const buyer = findUserById(order.userId);
      if (buyer) {
        await sendPaymentSuccessEmail({
          to: buyer.email,
          userName: buyer.name,
          orderId: order.id,
          planId: order.plan,
          amountIdr: order.amountIdr,
          provider: order.provider,
          dashboardUrl,
        });
      }
    }
  } else if (next === "failed" || next === "expired") {
    setOrderStatus(orderId, next);
  }
  return jsonOk({ ok: true });
}

async function handleMayar(event: string, data: Record<string, unknown>, dashboardUrl: string) {
  // Hanya payment.received yang berarti uang masuk; sisanya (reminder,
  // membership, shipper) bukan urusan tagihan paket MyPRD.
  if (event !== "payment.received") return jsonOk({ ok: true, ignored: event });

  const extra = (data.extraData ?? {}) as Record<string, unknown>;
  const orderId = String(extra[MAYAR_ORDER_KEY] ?? "");
  if (!orderId) return jsonError("Webhook Mayar tanpa extraData order.", 400);
  const order = getOrderById(orderId);
  if (!order) return jsonError("Order tidak ditemukan.", 404);

  // Webhook Mayar bisa dipalsukan: satu-satunya bukti sah adalah status dari
  // API Mayar sendiri. Query gagal (rate limit / downtime) → 502 supaya Mayar
  // mengirim ulang, bukan dianggap lunas.
  const payment = await mayarPaymentRequest(String(data.id ?? ""));
  if (payment.status !== "paid") return jsonOk({ ok: true, verified: false, status: payment.status });
  const webhookAmount = Number(data.amount);
  if (Number.isFinite(webhookAmount) && webhookAmount > 0 && webhookAmount !== order.amountIdr) {
    console.error("[mayar] amount tidak cocok", orderId, webhookAmount, order.amountIdr);
    return jsonOk({ ok: true, verified: false, reason: "amount_mismatch" });
  }

  const result = markOrderPaid(orderId);
  if (result && !result.alreadyPaid) {
    const buyer = findUserById(order.userId);
    if (buyer) {
      await sendPaymentSuccessEmail({
        to: buyer.email,
        userName: buyer.name,
        orderId: order.id,
        planId: order.plan,
        amountIdr: order.amountIdr,
        provider: order.provider,
        dashboardUrl,
      });
    }
  }
  return jsonOk({ ok: true, verified: true });
}
