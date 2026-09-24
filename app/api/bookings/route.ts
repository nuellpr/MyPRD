import { requireUser } from "@/lib/auth";
import { billingProvider, CONSULT_PRODUCT, createSnapTransaction, midtransClientKey } from "@/lib/billing";
import { errorToResponse, jsonError, jsonOk, readJson } from "@/lib/http";
import { sanitizeUserText } from "@/lib/safety";
import { createBooking, createOrder, linkBookingOrder, listBookings, setOrderProviderRef } from "@/lib/repo";

/**
 * Booking konsultasi 1 sesi (60 menit), bayar di muka.
 * POST body: { topic, contact?, preferredDate? } → booking `pending_payment`
 * + order konsultasi. GET → daftar booking user.
 */
export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk({ bookings: listBookings(user.id), product: CONSULT_PRODUCT });
  } catch (error) {
    return errorToResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<{ topic?: string; contact?: string; preferredDate?: string }>(request);
    const topic = sanitizeUserText(body.topic ?? "", 500);
    if (!topic) return jsonError("Topik konsultasi wajib diisi.", 400);
    const contact = sanitizeUserText(body.contact ?? "", 100);
    const preferredDate = sanitizeUserText(body.preferredDate ?? "", 100);
    const provider = billingProvider();
    const booking = createBooking({ userId: user.id, topic, contact, preferredDate });
    const order = createOrder({
      userId: user.id,
      plan: CONSULT_PRODUCT.id,
      amountIdr: CONSULT_PRODUCT.priceIdr,
      provider,
    });
    linkBookingOrder(booking.id, order.id);
    if (provider === "midtrans") {
      const snap = await createSnapTransaction({
        orderId: order.id,
        amountIdr: CONSULT_PRODUCT.priceIdr,
        planName: CONSULT_PRODUCT.name,
        customerEmail: user.email,
        customerName: user.name,
        itemName: `MyPRD ${CONSULT_PRODUCT.name}`,
      });
      setOrderProviderRef(order.id, snap.token);
      return jsonOk({
        booking,
        order: { ...order, providerRef: snap.token },
        provider,
        snapToken: snap.token,
        redirectUrl: snap.redirectUrl,
        clientKey: midtransClientKey(),
      });
    }
    return jsonOk({ booking, order, provider });
  } catch (error) {
    return errorToResponse(error);
  }
}
