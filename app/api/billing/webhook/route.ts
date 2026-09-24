import { confirmBookingPayment, getOrderById, setOrderStatus } from "@/lib/repo";
import { mapMidtransStatus, verifyMidtransSignature } from "@/lib/billing";
import { errorToResponse, jsonError, jsonOk, readJson } from "@/lib/http";

/**
 * Webhook notifikasi Midtrans (tanpa auth sesi — dipanggil server Midtrans).
 * Signature_key diverifikasi dulu; penanda lunas bersifat idempoten.
 *
 * Untuk lokal: daftarkan URL publik (mis. via ngrok) di dashboard Midtrans
 * sebagai Payment Notification URL. Tanpa itu, pakai provider mock.
 */
export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
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
      confirmBookingPayment(orderId);
    } else if (next === "failed" || next === "expired") {
      setOrderStatus(orderId, next);
    }
    return jsonOk({ ok: true });
  } catch (error) {
    return errorToResponse(error);
  }
}
