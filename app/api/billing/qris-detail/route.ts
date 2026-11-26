import { requireUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/env";
import { errorToResponse, jsonError, jsonOk, readJson } from "@/lib/http";
import { getPlan } from "@/lib/plans";
import {
  extractQrisMerchant,
  parseQrisOrderRef,
  renderQrisDataUrl,
  renderQrisSvg,
} from "@/lib/qris";
import { getOrder, getOrderById } from "@/lib/repo";

/**
 * POST /api/billing/qris-detail  body: { order_id }
 * Render ulang QRIS dinamis untuk order pending milik user (atau admin).
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<{ order_id?: string }>(request);
    const orderId = String(body.order_id ?? "");
    const order = isAdminEmail(user.email) ? getOrderById(orderId) : getOrder(user.id, orderId);
    if (!order) return jsonError("Order tidak ditemukan.", 404);
    if (order.provider !== "qris") return jsonError("Order ini bukan pembayaran QRIS.", 400);

    const meta = parseQrisOrderRef(order.providerRef);
    if (!meta.payload) return jsonError("Payload QRIS order ini tidak tersedia.", 400);

    const [svg, qrDataUrl] = await Promise.all([
      renderQrisSvg(meta.payload),
      renderQrisDataUrl(meta.payload),
    ]);
    const plan = getPlan(order.plan);

    return jsonOk({
      order,
      qris: {
        payload: meta.payload,
        svg,
        qrDataUrl,
        merchant: extractQrisMerchant(meta.payload),
        baseAmountIdr: plan.priceIdr,
        uniqueCode: Math.max(0, order.amountIdr - plan.priceIdr),
        confirmedAt: meta.confirmedAt,
        note: meta.note,
      },
    });
  } catch (error) {
    return errorToResponse(error);
  }
}
