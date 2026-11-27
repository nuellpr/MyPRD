"use client";

import Link from "next/link";
import { IconArrowRight } from "@/components/icons";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { TemplateIcon } from "./TemplateIcon";

export interface TemplateSummary {
  slug: string;
  name: string;
  version: string;
  price: string;
  tagline: string;
  stackSummary: string;
}

export function TemplateCards({ items }: { items: TemplateSummary[] }) {
  function handleMove(e: React.MouseEvent<HTMLElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const my = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    e.currentTarget.style.setProperty("--mx", `${mx}%`);
    e.currentTarget.style.setProperty("--my", `${my}%`);
  }

  return (
    <Stagger inView={false} className="mt-8 grid gap-5 md:grid-cols-2">
      {items.map((template) => (
        <StaggerItem
          as="article"
          key={template.slug}
          className="tilt-glow card-lift flex flex-col rounded-2xl border border-slate-800/90 bg-[#0b1022]/80 p-6"
        >
          <div onMouseMove={handleMove} className="flex flex-1 flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <TemplateIcon slug={template.slug} />
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    <Link href={`/templates/${template.slug}`} className="transition hover:text-[#35d6ff]">
                      {template.name}
                    </Link>
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">Versi {template.version}</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-300">
                {template.price}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-300">{template.tagline}</p>
            <p className="mt-3 text-xs text-slate-500">{template.stackSummary}</p>
            <div className="mt-5 flex flex-wrap gap-3 pt-1">
              <Link
                href={`/templates/${template.slug}`}
                className="btn-shine inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
              >
                Prompt install
                <IconArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={`/dashboard?template=${template.slug}`}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-[#35d6ff]/50 hover:text-white"
              >
                Bikin PRD dengan template
              </Link>
            </div>
          </div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
