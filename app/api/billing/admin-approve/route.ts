import { findUserById, requireUser } from "@/lib/auth";
import { sendPaymentRejectedEmail, sendPaymentSuccessEmail } from "@/lib/billing-email";
import { isAdminEmail } from "@/lib/env";
import { errorToResponse, jsonError, jsonOk, readJson } from "@/lib/http";
import { getOrderById, markOrderPaid, setOrderStatus } from "@/lib/repo";

/**
 * POST /api/billing/admin-approve  body: { order_id, action?: "approve" | "reject" }
 * Khusus email admin (ADMIN_EMAILS) untuk menyetujui atau menolak order QRIS manual.
 */
export async function POST(request: Request) {
  try {
    const admin = await requireUser();
    if (!isAdminEmail(admin.email)) {
      return jsonError("Hanya admin yang dapat memverifikasi pembayaran.", 403);
    }

    const body = await readJson<{ order_id?: string; action?: string }>(request);
    const order = getOrderById(String(body.order_id ?? ""));
    if (!order) return jsonError("Order tidak ditemukan.", 404);

    const buyer = findUserById(order.userId);
    if (body.action === "reject") {
      const updated = setOrderStatus(order.id, "failed");
      if (buyer && updated && updated.status === "failed" && order.status === "pending") {
        await sendPaymentRejectedEmail({
          to: buyer.email,
          userName: buyer.name,
          orderId: order.id,
          planId: order.plan,
          amountIdr: order.amountIdr,
          billingUrl: new URL("/billing", request.url).toString(),
        });
      }
      return jsonOk({ order: updated });
    }

    const result = markOrderPaid(order.id);
    if (!result) return jsonError("Order tidak ditemukan.", 404);

    if (buyer && !result.alreadyPaid) {
      await sendPaymentSuccessEmail({
        to: buyer.email,
        userName: buyer.name,
        orderId: order.id,
        planId: order.plan,
        amountIdr: order.amountIdr,
        provider: order.provider,
        dashboardUrl: new URL("/dashboard", request.url).toString(),
      });
    }

    return jsonOk({ order: result.order, alreadyPaid: result.alreadyPaid });
  } catch (error) {
    return errorToResponse(error);
  }
}
