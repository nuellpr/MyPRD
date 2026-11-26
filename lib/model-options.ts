import { defaultModelId, getAvailableProviders } from "./env.ts";

export interface ModelOption {
  id: string;
  label: string;
  models: { id: string; model: string }[];
}

export function modelOptionsFor(user?: { default_model_id?: string | null } | null): {
  providers: ModelOption[];
  initialModel: string;
} {
  const providers: ModelOption[] = getAvailableProviders().map((p) => ({
    id: p.id,
    label: p.label,
    models: p.models.map((model) => ({ id: `${p.id}/${model}`, model })),
  }));
  const availableModelIds = new Set(providers.flatMap((provider) => provider.models.map((model) => model.id)));
  const initialModel =
    user?.default_model_id && availableModelIds.has(user.default_model_id) ? user.default_model_id : defaultModelId();
  return { providers, initialModel };
}
