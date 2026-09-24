import { requireUser } from "@/lib/auth";
import { errorToResponse, jsonError, jsonOk } from "@/lib/http";
import { cancelBooking } from "@/lib/repo";

type Context = { params: Promise<{ id: string }> };

/**
 * Batalkan booking yang belum dibayar.
 * Saat ini hanya `cancel` yang didukung (status done dijadwalkan mentor manual).
 */
export async function PATCH(request: Request, { params }: Context) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const booking = cancelBooking(user.id, id);
    if (!booking) return jsonError("Booking tidak ditemukan.", 404);
    return jsonOk({ booking });
  } catch (error) {
    return errorToResponse(error);
  }
}
