import { currentUser, toPublicUser } from "@/lib/auth";
import { getQuotaState, getUsageSummary } from "@/lib/repo";
import { errorToResponse, jsonOk } from "@/lib/http";

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return jsonOk({ user: null, quota: null, usage: null });
    return jsonOk({
      user: toPublicUser(user),
      quota: getQuotaState(user.id, user.plan),
      usage: getUsageSummary(user.id),
    });
  } catch (error) {
    return errorToResponse(error);
  }
}
