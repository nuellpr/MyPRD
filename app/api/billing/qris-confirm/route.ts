import { requireUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { adminEmails } from "@/lib/env";
import { formatIdr } from "@/lib/format";
import { errorToResponse, jsonError, jsonOk, readJson } from "@/lib/http";
import { parseQrisOrderRef } from "@/lib/qris";
import { getOrder, setOrderProviderRef } from "@/lib/repo";
import { sanitizeUserText } from "@/lib/safety";

/**
 * POST /api/billing/qris-confirm  body: { order_id, note? }
 * Pembeli menandai sudah transfer lewat QRIS dinamis agar admin bisa memverifikasi.
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

    // Notifikasi admin bersifat best-effort agar konfirmasi tetap tercatat meski SMTP/Resend terbatas.
    const admins = adminEmails();
    if (admins.length > 0) {
      await Promise.allSettled(
        admins.map((to) =>
          sendEmail({
            to,
            subject: `[MyPRD] Konfirmasi QRIS ${formatIdr(order.amountIdr)} (${order.plan})`,
            html: `<p>User <strong>${user.email}</strong> mengonfirmasi pembayaran QRIS sebesar <strong>${formatIdr(
              order.amountIdr,
            )}</strong> untuk paket <strong>${order.plan}</strong>.</p><p>Order ID: <code>${order.id}</code>${
              nextMeta.note ? `<br/>Catatan: ${nextMeta.note}` : ""
            }</p><p>Buka halaman <code>/billing</code> sebagai admin untuk menyetujui dan mengaktifkan paket.</p>`,
          }),
        ),
      );
    }

    return jsonOk({ ok: true, confirmedAt, note: nextMeta.note ?? "" });
  } catch (error) {
    return errorToResponse(error);
  }
}
