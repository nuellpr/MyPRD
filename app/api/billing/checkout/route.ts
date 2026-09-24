import { requireUser } from "@/lib/auth";
import {
  billingProvider,
  checkoutPlan,
  createSnapTransaction,
  midtransClientKey,
} from "@/lib/billing";
import { errorToResponse, jsonOk, readJson } from "@/lib/http";
import { createOrder, setOrderProviderRef } from "@/lib/repo";

/**
 * Buat order langganan + siapkan pembayaran.
 * Body: { plan: "starter" | "pro" }.
 * - Provider mock → order `pending`, UI menampilkan tombol simulasi bayar.
 * - Provider midtrans → order `pending` + Snap token untuk snap.js.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<{ plan?: string }>(request);
    const plan = checkoutPlan(String(body.plan ?? ""));
    const provider = billingProvider();
    const order = createOrder({ userId: user.id, plan: plan.id, amountIdr: plan.priceIdr, provider });
    if (provider === "midtrans") {
      const snap = await createSnapTransaction({
        orderId: order.id,
        amountIdr: plan.priceIdr,
        planName: plan.name,
        customerEmail: user.email,
        customerName: user.name,
      });
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
