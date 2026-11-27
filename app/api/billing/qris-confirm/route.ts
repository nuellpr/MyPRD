import { requireUser } from "@/lib/auth";
import { sendAdminQrisConfirmEmail, sendPaymentSubmittedEmail } from "@/lib/billing-email";
import { adminEmails } from "@/lib/env";
import { errorToResponse, jsonError, jsonOk, publicUrl, readJson } from "@/lib/http";
import { parseQrisOrderRef } from "@/lib/qris";
import { getOrder, setOrderProviderRef } from "@/lib/repo";
import { sanitizeUserText } from "@/lib/safety";

/**
 * POST /api/billing/qris-confirm  body: { order_id, note? }
 * Pembeli menandai sudah transfer lewat QRIS agar admin bisa memverifikasi.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<{ order_id?: string; note?: string }>(request);
    const order = getOrder(user.id, String(body.order_id ?? ""));
    if (!order) return jsonError("Order tidak ditemukan.", 404);
    if (order.provider !== "qris") return jsonError("Order ini bukan pembayaran QRIS.", 400);
    if (order.status !== "pending") {
      return jsonError("Order ini sudah diproses dan tidak perlu dikonfirmasi ulang.", 400);
    }

    const meta = parseQrisOrderRef(order.providerRef);
    if (!meta.payload) return jsonError("Payload QRIS order tidak ditemukan.", 400);

    const note = sanitizeUserText(body.note, 120);
    const confirmedAt = meta.confirmedAt ?? Date.now();
    const nextMeta = {
      payload: meta.payload,
      confirmedAt,
      ...(note ? { note } : meta.note ? { note: meta.note } : {}),
    };
    setOrderProviderRef(order.id, JSON.stringify(nextMeta));

    const billingUrl = publicUrl(request, "/billing");
    const admins = adminEmails();
    const results = await Promise.allSettled([
      sendPaymentSubmittedEmail({
        to: user.email,
        userName: user.name,
        orderId: order.id,
        planId: order.plan,
        amountIdr: order.amountIdr,
        note: nextMeta.note,
        billingUrl,
      }),
      ...admins.map((to) =>
        sendAdminQrisConfirmEmail({
          to,
          buyerName: user.name,
          buyerEmail: user.email,
          orderId: order.id,
          planId: order.plan,
          amountIdr: order.amountIdr,
          note: nextMeta.note,
          billingUrl,
        }),
      ),
    ]);

    const buyerNotified = results[0]?.status === "fulfilled" && Boolean(results[0].value);
    return jsonOk({ ok: true, confirmedAt, note: nextMeta.note ?? "", emailNotified: buyerNotified });
  } catch (error) {
    return errorToResponse(error);
  }
}
