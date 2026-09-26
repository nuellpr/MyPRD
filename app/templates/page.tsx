import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { currentUser } from "@/lib/auth";
import { TEMPLATES, stackLine } from "@/lib/templates";

export const metadata = {
  title: "Template — MyPRD",
  description: "Starter kit codebase siap pakai. Salin prompt install ke AI coding agent-mu.",
};

export default async function TemplatesPage() {
  const user = await currentUser();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader authed={Boolean(user)} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Template</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Mulai dengan kerangka codebase yang sudah mengikuti best practice production. Hemat token AI dan fokus
          mengembangkan fitur yang kamu butuhkan.
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {TEMPLATES.map((template) => (
            <article
              key={template.slug}
              className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/40 p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    <Link href={`/templates/${template.slug}`} className="hover:text-sky-300">
                      {template.name}
                    </Link>
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">Versi {template.version}</p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-300">
                  {template.price}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-300">{template.tagline}</p>
              <p className="mt-3 text-xs text-slate-500">{stackLine(template)}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/templates/${template.slug}`}
                  className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
                >
                  Prompt install
                </Link>
                <Link
                  href={`/dashboard?template=${template.slug}`}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
                >
                  Bikin PRD dengan template
                </Link>
              </div>
            </article>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
