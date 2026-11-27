"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { CountUp } from "@/components/motion/CountUp";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";

export function DashboardStats({
  remaining,
  limit,
  used,
  quotaPercent,
  resetsLabel,
  prdCount,
  projectCount,
}: {
  remaining: number;
  limit: number;
  used: number;
  quotaPercent: number;
  resetsLabel: string;
  prdCount: number;
  projectCount: number;
}) {
  const reduced = useReducedMotion();

  return (
    <Stagger inView={false} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StaggerItem className="card-lift rounded-2xl border border-slate-800/90 bg-[#0b1022]/80 p-5">
        <p className="text-xs uppercase tracking-wide text-slate-500">Sisa kuota generate</p>
        <p className="mt-2 text-2xl font-semibold text-white">
          <CountUp value={remaining} />
          <span className="text-sm font-normal text-slate-400"> / <CountUp value={limit} /></span>
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: quotaPercent / 100 }}
            transition={{ duration: reduced ? 0.01 : 0.7, ease: [0.22, 1, 0.36, 1] }}
            className={`h-full w-full origin-left rounded-full ${
              quotaPercent >= 90
                ? "bg-red-500"
                : "bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa]"
            }`}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Reset {resetsLabel} · terpakai {used}
        </p>
      </StaggerItem>

      <StaggerItem className="card-lift rounded-2xl border border-slate-800/90 bg-[#0b1022]/80 p-5">
        <p className="text-xs uppercase tracking-wide text-slate-500">Total PRD</p>
        <p className="mt-2 text-2xl font-semibold text-white">
          <CountUp value={prdCount} />
        </p>
        <p className="mt-3 text-xs text-slate-500">Dari {projectCount} project</p>
      </StaggerItem>

      <StaggerItem className="card-lift rounded-2xl border border-slate-800/90 bg-[#0b1022]/80 p-5">
        <p className="text-xs uppercase tracking-wide text-slate-500">Template</p>
        <p className="mt-2 text-sm text-slate-300">Starter kit siap pakai + prompt install untuk AI agent.</p>
        <Link href="/templates" className="mt-3 inline-block text-sm text-[#35d6ff] hover:underline">
          Lihat template →
        </Link>
      </StaggerItem>

      <StaggerItem className="card-lift rounded-2xl border border-slate-800/90 bg-[#0b1022]/80 p-5">
        <p className="text-xs uppercase tracking-wide text-slate-500">Komunitas</p>
        <p className="mt-2 text-sm text-slate-300">Diskusi, template, dan coaching bareng builder lain.</p>
        <a
          href="https://discord.gg/yVQWsrQDbM"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm text-[#35d6ff] hover:underline"
        >
          Gabung Discord →
        </a>
        <br />
        <Link href="/komunitas" className="mt-1.5 inline-block text-sm text-[#35d6ff] hover:underline">
          Papan peringkat →
        </Link>
      </StaggerItem>
    </Stagger>
  );
}
