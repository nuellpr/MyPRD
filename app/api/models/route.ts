import { defaultModelId, getAvailableProviders } from "@/lib/env";
import { errorToResponse, jsonOk } from "@/lib/http";

/** Daftar provider & model yang bisa dipilih user di UI. */
export async function GET() {
  try {
    const providers = getAvailableProviders().map((p) => ({
      id: p.id,
      label: p.label,
      models: p.models.map((model) => ({ id: `${p.id}/${model}`, model })),
    }));
    return jsonOk({ providers, defaultModel: defaultModelId() });
  } catch (error) {
    return errorToResponse(error);
  }
}
