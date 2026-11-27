import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconArrowRight, IconShield } from "@/components/icons";
import { Reveal, WordReveal } from "@/components/motion/Reveal";
import { SettingsForm } from "@/components/SettingsForm";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { currentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/env";
import { getPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/settings");

  const plan = getPlan(user.plan);
  const admin = isAdminEmail(user.email);
  const initial = (user.name || user.email).trim().charAt(0).toUpperCase();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader authed />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#35d6ff]">Akun</p>
          <WordReveal text="Profil & pengaturan" className="mt-2 text-2xl font-semibold text-white sm:text-3xl" />
          <p className="mt-2 text-sm text-slate-400">
            Atur foto profil, keamanan 2FA, password, atau penghapusan akunmu.
          </p>
        </div>

        <Reveal delay={0.04} className="mt-8">
          <section className="flex flex-col gap-4 rounded-2xl border border-slate-800/90 bg-[#0b1022]/80 p-6 sm:flex-row sm:items-center">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-linear-to-br from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] text-xl font-bold text-slate-950">
              {user.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={user.name || user.email}
                  width={56}
                  height={56}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              ) : (
                initial
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-semibold text-white">{user.name}</h2>
                <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-0.5 text-xs text-slate-300">
                  {plan.name}
                </span>
                {user.two_factor_enabled === 1 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs text-emerald-200">
                    2FA Aktif
                  </span>
                ) : null}
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
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-[#35d6ff]/60 hover:text-white"
            >
              Dashboard <IconArrowRight className="h-4 w-4" />
            </Link>
          </section>
        </Reveal>

        <div className="mt-6">
          <SettingsForm
            initialName={user.name}
            email={user.email}
            initialPhone={user.phone}
            initialBio={user.bio}
            initialAvatarUrl={user.avatar_url}
            initialTwoFactorEnabled={user.two_factor_enabled === 1}
            hasPassword={Boolean(user.password_hash)}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
