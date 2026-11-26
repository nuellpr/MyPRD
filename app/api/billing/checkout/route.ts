import { requireUser } from "@/lib/auth";
import {
  BillingError,
  billingProvider,
  checkoutPlan,
  createMayarPaymentRequest,
  createSnapTransaction,
  midtransClientKey,
} from "@/lib/billing";
import { errorToResponse, jsonOk, readJson } from "@/lib/http";
import {
  createDynamicQris,
  extractQrisMerchant,
  qrisStaticPayload,
  renderQrisDataUrl,
  renderQrisSvg,
} from "@/lib/qris";
import { createOrder, pickUniqueQrisAmount, setOrderProviderRef, setOrderStatus } from "@/lib/repo";

/**
 * Buat order langganan + siapkan pembayaran.
 * Body: { plan: "starter" | "pro" }.
 * - Provider qris → QRIS dinamis dari payload statis + kode unik 3 digit.
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

    if (provider === "qris") {
      const staticPayload = qrisStaticPayload();
      if (!staticPayload) {
        throw new BillingError("QRIS_STATIC_PAYLOAD belum diisi — cek konfigurasi .env.", 503);
      }
      const uniqueAmount = pickUniqueQrisAmount(plan.priceIdr);
      const dynamicPayload = createDynamicQris(staticPayload, uniqueAmount);
      const [svg, qrDataUrl] = await Promise.all([
        renderQrisSvg(dynamicPayload),
        renderQrisDataUrl(dynamicPayload),
      ]);
      const providerRef = JSON.stringify({ payload: dynamicPayload });
      const order = createOrder({
        userId: user.id,
        plan: plan.id,
        amountIdr: uniqueAmount,
        provider: "qris",
      });
      setOrderProviderRef(order.id, providerRef);
      return jsonOk({
        order: { ...order, providerRef },
        provider,
        qris: {
          payload: dynamicPayload,
          svg,
          qrDataUrl,
          merchant: extractQrisMerchant(dynamicPayload),
          baseAmountIdr: plan.priceIdr,
          uniqueCode: uniqueAmount - plan.priceIdr,
        },
      });
    }

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
