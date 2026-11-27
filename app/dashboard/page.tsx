import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { DeleteProjectButton } from "@/components/dashboard/DeleteProjectButton";
import { IconCheck, IconSettings, IconShield } from "@/components/icons";
import { LogoutButton } from "@/components/LogoutButton";
import { Reveal, Stagger, StaggerItem, WordReveal } from "@/components/motion/Reveal";
import { PromptComposer } from "@/components/PromptComposer";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { currentUser, toPublicUser } from "@/lib/auth";
import { badgesForStats, getUserStats } from "@/lib/community";
import { isAdminEmail } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { modelOptionsFor } from "@/lib/model-options";
import { getPlan } from "@/lib/plans";
import { getQuotaState, listProjects } from "@/lib/repo";

const STATUS_LABEL: Record<string, string> = {
  chatting: "Sedang ngobrol",
  prd_ready: "PRD siap",
};

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/dashboard");

  const publicUser = toPublicUser(user);
  const plan = getPlan(user.plan);
  const quota = getQuotaState(user.id, user.plan);
  const projects = listProjects(user.id);
  const { providers, initialModel } = modelOptionsFor(user);
  const quotaPercent = quota.unlimited
    ? 100
    : quota.limit > 0
      ? Math.min(100, Math.round((quota.used / quota.limit) * 100))
      : 0;
  const badges = badgesForStats(getUserStats(user.id));
  const admin = isAdminEmail(user.email);
  const prdCount = projects.filter((p) => p.status === "prd_ready").length;

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader authed />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <WordReveal text={`Halo, ${publicUser.name} 👋`} className="text-2xl font-semibold text-white sm:text-3xl" />
            <p className="mt-1 text-sm text-slate-400">Lanjutkan PRD-mu atau mulai project baru.</p>
          </div>
          <p className="flex items-center gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-slate-700/80 bg-slate-900/70 px-2.5 py-1 font-medium text-slate-200">
              Paket {plan.name}
            </span>
            <Link href="/billing" className="text-[#35d6ff] hover:underline">
              {plan.id === "free" ? "Upgrade →" : "Kelola billing →"}
            </Link>
          </p>
        </div>

        {/* Composer at the top */}
        <section className="mt-6">
          <Suspense fallback={<div className="h-44 animate-pulse rounded-2xl border border-slate-800 bg-[#0d1326]/70" />}>
            <PromptComposer authed providers={providers} defaultModel={initialModel} variant="dashboard" />
          </Suspense>
        </section>

        {/* Stats */}
        <DashboardStats
          remaining={quota.remaining}
          limit={quota.limit}
          used={quota.used}
          unlimited={quota.unlimited}
          quotaPercent={quotaPercent}
          resetsLabel={formatDate(quota.resetsAt)}
          prdCount={prdCount}
          projectCount={projects.length}
        />

        {/* Profile card */}
        <Reveal delay={0.05} className="mt-6">
          <section className="rounded-2xl border border-slate-800/90 bg-[#0b1022]/80 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-linear-to-br from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] text-base font-bold text-slate-950">
                  {publicUser.avatarUrl ? (
                    <Image
                      src={publicUser.avatarUrl}
                      alt={publicUser.name || publicUser.email}
                      width={44}
                      height={44}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (publicUser.name || publicUser.email).trim().charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-white">{publicUser.name}</p>
                    {admin ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-[11px] text-violet-200">
                        <IconShield className="h-3 w-3" /> Admin
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-sm text-slate-400">{publicUser.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700/80 px-3 py-2 text-sm text-slate-300 transition hover:border-[#35d6ff]/60 hover:text-white"
                >
                  <IconSettings className="h-4 w-4" /> Pengaturan
                </Link>
                <LogoutButton />
              </div>
            </div>
          </section>
        </Reveal>

        {/* Badges */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-white">Lencana saya</h2>
          {badges.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">
              Belum ada lencana — susun PRD pertamamu untuk meraih Perintis.{" "}
              <Link href="/komunitas" className="text-[#35d6ff] hover:underline">
                Lihat semua lencana →
              </Link>
            </p>
          ) : (
            <Stagger as="ul" inView={false} className="mt-3 flex flex-wrap gap-2">
              {badges.map((badge) => (
                <StaggerItem
                  as="li"
                  key={badge.id}
                  className="btn-shine rounded-full border border-amber-500/40 bg-amber-500/10 px-3.5 py-1 text-sm font-medium text-amber-200"
                >
                  <span title={badge.description}>{badge.name}</span>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </section>

        {/* Projects */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-white">Project kamu</h2>
          {projects.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-slate-800 bg-[#0b1022]/40 p-10 text-center">
              <div className="float-y mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-[#35d6ff]/30 bg-[#35d6ff]/10 text-[#35d6ff]">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                  <path d="M14 2v6h6M8 13h8M8 17h5" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-200">Belum ada project</p>
              <p className="mt-1 text-xs text-slate-400">Mulai dengan menulis ide aplikasimu di composer di atas.</p>
            </div>
          ) : (
            <Stagger as="ul" inView={false} className="mt-4 grid gap-3 sm:grid-cols-2">
              {projects.map((project) => (
                <StaggerItem as="li" key={project.id}>
                  <Link
                    href={`/dashboard/${project.id}`}
                    className="card-lift block rounded-2xl border border-slate-800/90 bg-[#0b1022]/80 p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-medium text-white">{project.title}</h3>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                          project.status === "prd_ready"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {project.status === "prd_ready" ? (
                          <IconCheck className="h-3 w-3" />
                        ) : (
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300" />
                        )}
                        {STATUS_LABEL[project.status] ?? project.status}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-400">{project.idea || "(tanpa deskripsi ide)"}</p>
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="truncate">
                        {project.modelId} · diperbarui {formatDate(project.updatedAt)}
                      </span>
                      <DeleteProjectButton projectId={project.id} projectTitle={project.title} />
                    </div>
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
