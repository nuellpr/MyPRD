import { requireUser } from "@/lib/auth";
import {
  BillingError,
  billingProvider,
  checkoutPlan,
  createMayarPaymentRequest,
  createSnapTransaction,
  midtransClientKey,
} from "@/lib/billing";
import { sendOrderCreatedEmail } from "@/lib/billing-email";
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
    const billingUrl = new URL("/billing", request.url).toString();

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
      const merchant = extractQrisMerchant(dynamicPayload);
      const providerRef = JSON.stringify({ payload: dynamicPayload });
      const order = createOrder({
        userId: user.id,
        plan: plan.id,
        amountIdr: uniqueAmount,
        provider: "qris",
      });
      setOrderProviderRef(order.id, providerRef);
      const emailNotified = await sendOrderCreatedEmail({
        to: user.email,
        userName: user.name,
        orderId: order.id,
        planId: plan.id,
        amountIdr: uniqueAmount,
        baseAmountIdr: plan.priceIdr,
        uniqueCode: uniqueAmount - plan.priceIdr,
        provider: "qris",
        merchantName: merchant.merchantName,
        nmid: merchant.nmid,
        billingUrl,
      });
      return jsonOk({
        order: { ...order, providerRef },
        provider,
        emailNotified,
        qris: {
          payload: dynamicPayload,
          svg,
          qrDataUrl,
          merchant,
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
          redirectUrl: billingUrl,
        });
      } catch (error) {
        setOrderStatus(order.id, "failed");
        throw error;
      }
      setOrderProviderRef(order.id, payment.id);
      const emailNotified = await sendOrderCreatedEmail({
        to: user.email,
        userName: user.name,
        orderId: order.id,
        planId: plan.id,
        amountIdr: plan.priceIdr,
        provider,
        billingUrl,
      });
      return jsonOk({ order: { ...order, providerRef: payment.id }, provider, emailNotified, redirectUrl: payment.link });
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
      const emailNotified = await sendOrderCreatedEmail({
        to: user.email,
        userName: user.name,
        orderId: order.id,
        planId: plan.id,
        amountIdr: plan.priceIdr,
        provider,
        billingUrl,
      });
      return jsonOk({
        order: { ...order, providerRef: snap.token },
        provider,
        emailNotified,
        snapToken: snap.token,
        redirectUrl: snap.redirectUrl,
        clientKey: midtransClientKey(),
      });
    }
    const emailNotified = await sendOrderCreatedEmail({
      to: user.email,
      userName: user.name,
      orderId: order.id,
      planId: plan.id,
      amountIdr: plan.priceIdr,
      provider,
      billingUrl,
    });
    return jsonOk({ order, provider, emailNotified });
  } catch (error) {
    return errorToResponse(error);
  }
}
