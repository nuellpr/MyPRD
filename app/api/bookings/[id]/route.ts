import { requireUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/env";
import { errorToResponse, jsonError, jsonOk, readJson } from "@/lib/http";
import { cancelBooking, completeBooking } from "@/lib/repo";

type Context = { params: Promise<{ id: string }> };

/**
 * PATCH tanpa body: batalkan booking milik sendiri yang belum dibayar.
 * PATCH { action: "complete" }: mentor menandai booking terjadwal sebagai
 * selesai (butuh ADMIN_EMAILS).
 */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      const body = await readJson<{ action?: string }>(request);
      if (body.action === "complete") {
        if (!isAdminEmail(user.email)) return jsonError("Hanya mentor yang bisa menandai selesai.", 403);
        const done = completeBooking(id);
        if (!done) return jsonError("Booking tidak ditemukan atau belum terjadwal.", 404);
        return jsonOk({ booking: done });
      }
    }
    const booking = cancelBooking(user.id, id);
    if (!booking) return jsonError("Booking tidak ditemukan.", 404);
    return jsonOk({ booking });
  } catch (error) {
    return errorToResponse(error);
  }
}
