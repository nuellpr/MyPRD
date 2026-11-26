import { requireUser } from "@/lib/auth";
import { mayarPaymentRequest } from "@/lib/billing";
import { sendPaymentSuccessEmail } from "@/lib/billing-email";
import { errorToResponse, jsonError, jsonOk, readJson } from "@/lib/http";
import { getOrder, markOrderPaid } from "@/lib/repo";

/**
 * POST /api/billing/check-status  body: { order_id }
 *
 * Mayar hanya menyimpan SATU urlHook per akun merchant, jadi MyPRD tidak bisa
 * punya webhook-nya sendiri tanpa mematikan webhook aplikasi lain di akun yang
 * sama. Alternatifnya: user menekan tombol ini setelah membayar, lalu server
 * menanyakan status payment request ke API Mayar dengan API key kita sendiri.
 * Sumbernya sama seperti verifikasi webhook — bukan klaim dari browser.
 *
 * Aman dipanggil berulang: `markOrderPaid` idempoten.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<{ order_id?: string }>(request);
    const order = getOrder(user.id, String(body.order_id ?? ""));
    if (!order) return jsonError("Order tidak ditemukan.", 404);
    if (order.provider !== "mayar") return jsonError("Order ini bukan pembayaran Mayar.", 400);
    if (!order.providerRef) return jsonError("Order ini belum punya referensi pembayaran.", 400);

    const payment = await mayarPaymentRequest(order.providerRef);
    if (payment.status === "paid") {
      const result = markOrderPaid(order.id);
      if (result && !result.alreadyPaid) {
        await sendPaymentSuccessEmail({
          to: user.email,
          userName: user.name,
          orderId: order.id,
          planId: order.plan,
          amountIdr: order.amountIdr,
          provider: order.provider,
          dashboardUrl: new URL("/dashboard", request.url).toString(),
        });
      }
    }

    return jsonOk({ status: payment.status, link: payment.link });
  } catch (error) {
    return errorToResponse(error);
  }
}
