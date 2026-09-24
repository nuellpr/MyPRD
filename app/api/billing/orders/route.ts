import { requireUser } from "@/lib/auth";
import { billingProvider } from "@/lib/billing";
import { errorToResponse, jsonOk } from "@/lib/http";
import { listOrders } from "@/lib/repo";

/** Riwayat order langganan milik user yang login. */
export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk({ orders: listOrders(user.id), provider: billingProvider() });
  } catch (error) {
    return errorToResponse(error);
  }
}
