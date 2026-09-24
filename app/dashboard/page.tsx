import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NewProjectForm, type ModelOption } from "@/components/NewProjectForm";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { currentUser, toPublicUser } from "@/lib/auth";
import { defaultModelId, getAvailableProviders } from "@/lib/env";
import { getPlan } from "@/lib/plans";
import { getQuotaState, listProjects } from "@/lib/repo";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

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
  const providers: ModelOption[] = getAvailableProviders().map((p) => ({
    id: p.id,
    label: p.label,
    models: p.models.map((model) => ({ id: `${p.id}/${model}`, model })),
  }));
  const quotaPercent = quota.limit > 0 ? Math.min(100, Math.round((quota.used / quota.limit) * 100)) : 0;

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader authed />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Halo, {publicUser.name} 👋</h1>
            <p className="mt-1 text-sm text-slate-400">Lanjutkan PRD-mu atau mulai project baru.</p>
          </div>
          <p className="text-xs text-slate-500">
            Paket: <span className="font-medium text-slate-300">{plan.name}</span>
            {" · "}
            <Link href="/billing" className="text-sky-400 hover:underline">
              {plan.id === "free" ? "Upgrade →" : "Kelola billing →"}
            </Link>
          </p>
        </div>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Sisa kuota generate</p>
            <p className="mt-2 text-2xl font-semibold">
              {quota.remaining}
              <span className="text-sm font-normal text-slate-400"> / {quota.limit}</span>
            </p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full ${quotaPercent >= 90 ? "bg-red-500" : "bg-sky-500"}`}
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Reset {formatDate(quota.resetsAt)} · terpakai {quota.used}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total PRD</p>
            <p className="mt-2 text-2xl font-semibold">{projects.filter((p) => p.status === "prd_ready").length}</p>
            <p className="mt-3 text-xs text-slate-500">Dari {projects.length} project</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Template</p>
            <p className="mt-2 text-sm text-slate-300">Starter kit siap pakai + prompt install untuk AI agent.</p>
            <Link href="/templates" className="mt-3 inline-block text-sm text-sky-400 hover:underline">
              Lihat template →
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Konsultasi</p>
            <p className="mt-2 text-sm text-slate-300">Sesi 1-on-1 60 menit: review PRD & arahan eksekusi.</p>
            <Link href="/konsultasi" className="mt-3 inline-block text-sm text-sky-400 hover:underline">
              Booking sesi →
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Komunitas</p>
            <p className="mt-2 text-sm text-slate-300">Diskusi, template, dan coaching bareng builder lain.</p>
            <a
              href="https://discord.com"
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm text-sky-400 hover:underline"
            >
              Gabung Discord →
            </a>
          </div>
        </section>

        <section className="mt-8">
          <Suspense>
            <NewProjectForm providers={providers} defaultModel={defaultModelId()} />
          </Suspense>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Project kamu</h2>
          {projects.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
              Belum ada project. Mulai dengan menulis idemu di atas.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {projects.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/dashboard/${project.id}`}
                    className="block rounded-2xl border border-slate-800 bg-slate-900/40 p-5 transition hover:border-sky-500/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-medium">{project.title}</h3>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
                          project.status === "prd_ready"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {STATUS_LABEL[project.status] ?? project.status}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-400">{project.idea || "(tanpa deskripsi ide)"}</p>
                    <p className="mt-3 text-xs text-slate-500">
                      {project.modelId} · diperbarui {formatDate(project.updatedAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
