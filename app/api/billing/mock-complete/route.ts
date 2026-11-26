import { requireUser } from "@/lib/auth";
import { BillingError, billingProvider } from "@/lib/billing";
import { errorToResponse, jsonError, jsonOk, readJson } from "@/lib/http";
import { getOrder, markOrderPaid } from "@/lib/repo";

/**
 * Simulasi pembayaran berhasil — HANYA untuk provider mock (dev/test lokal).
 * Body: { order_id: string }. Menandai order lunas (+ upgrade paket untuk
 * order langganan).
 */
export async function POST(request: Request) {
  try {
    if (billingProvider() !== "mock") {
      throw new BillingError("Simulasi mock tidak aktif — selesaikan pembayaran via Midtrans.", 400);
    }
    const user = await requireUser();
    const body = await readJson<{ order_id?: string }>(request);
    const order = getOrder(user.id, String(body.order_id ?? ""));
    if (!order) return jsonError("Order tidak ditemukan.", 404);
    if (order.provider !== "mock") {
      throw new BillingError("Order ini memakai Midtrans — selesaikan via pembayaran asli.", 400);
    }
    const result = markOrderPaid(order.id);
    if (!result) return jsonError("Order tidak ditemukan.", 404);
    return jsonOk({ order: result.order, alreadyPaid: result.alreadyPaid });
  } catch (error) {
    return errorToResponse(error);
  }
}
