import { requireUser } from "@/lib/auth";
import {
  billingProvider,
  checkoutPlan,
  createMayarPaymentRequest,
  createSnapTransaction,
  midtransClientKey,
} from "@/lib/billing";
import { errorToResponse, jsonOk, readJson } from "@/lib/http";
import { createOrder, setOrderProviderRef, setOrderStatus } from "@/lib/repo";

/**
 * Buat order langganan + siapkan pembayaran.
 * Body: { plan: "starter" | "pro" }.
 * - Provider mock → order `pending`, UI menampilkan tombol simulasi bayar.
 * - Provider midtrans → order `pending` + Snap token untuk snap.js.
 * - Provider mayar → order `pending` + link pembayaran Mayar (redirect langsung).
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<{ plan?: string }>(request);
    const plan = checkoutPlan(String(body.plan ?? ""));
    const provider = billingProvider();
    const order = createOrder({ userId: user.id, plan: plan.id, amountIdr: plan.priceIdr, provider });
    if (provider === "mayar") {
      let payment;
      try {
        payment = await createMayarPaymentRequest({
          orderId: order.id,
          amountIdr: plan.priceIdr,
          description: `MyPRD ${plan.name} — langganan 1 bulan`,
          customerEmail: user.email,
          customerName: user.name,
          redirectUrl: new URL("/billing", request.url).toString(),
        });
      } catch (error) {
        setOrderStatus(order.id, "failed");
        throw error;
      }
      // Yang disimpan adalah id payment request Mayar, bukan link-nya: id yang
      // bisa di-requery untuk memastikan status (tombol "cek status" di /billing
      // dan verifikasi webhook). Link diambil lagi dari API saat dibutuhkan.
      setOrderProviderRef(order.id, payment.id);
      return jsonOk({ order: { ...order, providerRef: payment.id }, provider, redirectUrl: payment.link });
    }
    if (provider === "midtrans") {
      let snap;
      try {
        snap = await createSnapTransaction({
          orderId: order.id,
          amountIdr: plan.priceIdr,
          planName: plan.name,
          customerEmail: user.email,
          customerName: user.name,
        });
      } catch (error) {
        // Tanpa Snap token order ini tidak bisa dibayar — tandai gagal supaya
        // tidak menggantung sebagai "pending" selamanya di riwayat.
        setOrderStatus(order.id, "failed");
        throw error;
      }
      setOrderProviderRef(order.id, snap.token);
      return jsonOk({
        order: { ...order, providerRef: snap.token },
        provider,
        snapToken: snap.token,
        redirectUrl: snap.redirectUrl,
        clientKey: midtransClientKey(),
      });
    }
    return jsonOk({ order, provider });
  } catch (error) {
    return errorToResponse(error);
  }
}
