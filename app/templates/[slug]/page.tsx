import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { IconArrowRight, IconCheck, TemplateGlyph } from "@/components/icons";
import { Reveal, Stagger, StaggerItem, WordReveal } from "@/components/motion/Reveal";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { currentUser } from "@/lib/auth";
import { getTemplate } from "@/lib/templates";

type PageParams = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageParams) {
  const { slug } = await params;
  const template = getTemplate(slug);
  return {
    title: template ? `Template ${template.name} — MyPRD` : "Template tidak ditemukan — MyPRD",
  };
}

export default async function TemplateDetailPage({ params }: PageParams) {
  const { slug } = await params;
  const template = getTemplate(slug);
  if (!template) notFound();
  const user = await currentUser();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader authed={Boolean(user)} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <Link href="/templates" className="text-sm text-[#35d6ff] hover:underline">
          ← Semua template
        </Link>

        <Reveal className="mt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <TemplateGlyph slug={template.slug} />
              <div>
                <WordReveal text={template.name} className="text-3xl font-bold tracking-tight text-white" />
                <p className="mt-1 text-sm text-slate-400">{template.tagline}</p>
                <p className="mt-0.5 text-xs text-slate-500">v{template.version}</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-medium text-emerald-300">
              {template.price}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {template.stack.map((s) => (
              <span
                key={s.label}
                title={s.category}
                className="rounded-lg border border-slate-700/80 bg-[#0b1022]/80 px-2.5 py-1 text-xs text-slate-300"
              >
                <span className="text-slate-500">{s.category} · </span>
                {s.label}
              </span>
            ))}
          </div>

          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-slate-300">{template.description}</p>
        </Reveal>

        <Reveal delay={0.05} className="mt-8">
          <section className="rounded-2xl border border-slate-800/90 bg-[#0b1022]/80 p-6">
            <h2 className="font-semibold text-white">Sudah ada di template</h2>
            <Stagger as="ul" className="mt-3 space-y-2 text-sm text-slate-300">
              {template.includes.map((item) => (
                <StaggerItem as="li" key={item} className="flex items-start gap-2">
                  <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  {item}
                </StaggerItem>
              ))}
            </Stagger>
          </section>
        </Reveal>

        <Reveal delay={0.08} className="mt-6">
          <section className="glow-border rounded-2xl border border-slate-800/80 bg-[#0b1022]/85 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-white">Prompt install</h2>
              <CopyButton text={template.installPrompt} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Tempel prompt ini ke AI coding agent-mu (Claude Code, Cursor, OpenCode, Codex) di folder kosong.
            </p>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-[#060912] p-4 text-xs leading-relaxed text-slate-300">
              {template.installPrompt}
            </pre>
          </section>
        </Reveal>

        <Reveal delay={0.1} className="mt-6">
          <section>
            <h2 className="font-semibold text-white">Cara mulai</h2>
            <Stagger as="ol" className="mt-4 space-y-4">
              {template.steps.map((step, i) => (
                <StaggerItem as="li" key={step.title} className="flex gap-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#35d6ff]/40 bg-[#35d6ff]/15 text-sm font-semibold text-[#7fe3ff]">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">{step.title}</p>
                    <p className="mt-1 text-sm text-slate-400">{step.body}</p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
            <p className="mt-4 text-xs text-slate-500">
              Tidak ada perintah yang perlu kamu ketik sendiri. Semua dijalankan agent.
            </p>
          </section>
        </Reveal>

        <div className="mt-8">
          <Link
            href={`/dashboard?template=${template.slug}`}
            className="btn-shine inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] px-6 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110"
          >
            Bikin PRD dengan {template.name}
            <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
