import { findUserById, requireUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { isAdminEmail } from "@/lib/env";
import { formatIdr } from "@/lib/format";
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

    if (body.action === "reject") {
      const updated = setOrderStatus(order.id, "failed");
      return jsonOk({ order: updated });
    }

    const result = markOrderPaid(order.id);
    if (!result) return jsonError("Order tidak ditemukan.", 404);

    const buyer = findUserById(order.userId);
    if (buyer && !result.alreadyPaid) {
      await sendEmail({
        to: buyer.email,
        subject: `Paket MyPRD ${order.plan} sudah aktif`,
        html: `<p>Pembayaran QRIS kamu sebesar <strong>${formatIdr(
          order.amountIdr,
        )}</strong> (Order <code>${order.id}</code>) sudah diverifikasi.</p><p>Paket <strong>${
          order.plan
        }</strong> sekarang aktif di akunmu.</p>`,
      }).catch(() => undefined);
    }

    return jsonOk({ order: result.order, alreadyPaid: result.alreadyPaid });
  } catch (error) {
    return errorToResponse(error);
  }
}
