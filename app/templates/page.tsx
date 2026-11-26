import { WordReveal } from "@/components/motion/Reveal";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { TemplateCards } from "@/components/templates/TemplateCards";
import { currentUser } from "@/lib/auth";
import { stackLine, TEMPLATES } from "@/lib/templates";

export const metadata = {
  title: "Template — MyPRD",
  description: "Starter kit codebase siap pakai. Salin prompt install ke AI coding agent-mu.",
};

export default async function TemplatesPage() {
  const user = await currentUser();
  const items = TEMPLATES.map((t) => ({
    slug: t.slug,
    name: t.name,
    version: t.version,
    price: t.price,
    tagline: t.tagline,
    stackSummary: stackLine(t),
  }));

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader authed={Boolean(user)} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#35d6ff]">Starter Kit</p>
        <WordReveal text="Template & Showcase" className="mt-2 text-3xl font-bold tracking-tight text-white" />
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Mulai dengan kerangka codebase yang sudah mengikuti best practice production. Hemat token AI dan fokus
          mengembangkan fitur yang kamu butuhkan.
        </p>

        <TemplateCards items={items} />
      </main>

      <SiteFooter />
    </div>
  );
}
