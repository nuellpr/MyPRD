import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { SettingsForm } from "@/components/SettingsForm";
import { IconArrowRight, IconShield } from "@/components/icons";
import { currentUser } from "@/lib/auth";
import { defaultModelId, getAvailableProviders, isAdminEmail } from "@/lib/env";
import { getPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/settings");

  const providers = getAvailableProviders().map((provider) => ({
    id: provider.id,
    label: provider.label,
    models: provider.models.map((model) => ({ id: `${provider.id}/${model}`, model })),
  }));
  const availableModelIds = new Set(providers.flatMap((provider) => provider.models.map((model) => model.id)));
  const initialModel =
    user.default_model_id && availableModelIds.has(user.default_model_id) ? user.default_model_id : defaultModelId();
  const plan = getPlan(user.plan);
  const admin = isAdminEmail(user.email);
  const initial = (user.name || user.email).trim().charAt(0).toUpperCase();

  return (
    <>
      <SiteHeader authed />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
        <div className="hero-in">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-sky-300">Akun</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Profil & pengaturan</h1>
          <p className="mt-2 text-sm text-slate-400">Atur detail profil, password, dan model AI untuk project baru.</p>
        </div>

        <section className="hero-in mt-8 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 sm:flex-row sm:items-center" style={{ animationDelay: "90ms" }}>
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-sky-500 to-violet-400 text-xl font-bold text-slate-950">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-white">{user.name}</h2>
              <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-0.5 text-xs text-slate-300">
                {plan.name}
              </span>
              {admin ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-500/15 px-2.5 py-0.5 text-xs text-violet-200">
                  <IconShield className="h-3.5 w-3.5" /> Admin
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-sm text-slate-400">{user.email}</p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-sky-400/60 hover:text-white"
          >
            Dashboard <IconArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <div className="hero-in mt-6" style={{ animationDelay: "180ms" }}>
          <SettingsForm
            initialName={user.name}
            email={user.email}
            initialPhone={user.phone}
            initialBio={user.bio}
            hasPassword={Boolean(user.password_hash)}
            providers={providers}
            defaultModel={initialModel}
          />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
