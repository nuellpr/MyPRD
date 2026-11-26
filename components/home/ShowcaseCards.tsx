"use client";

import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";

function TiltCard({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const springRx = useSpring(rx, { stiffness: 260, damping: 24 });
  const springRy = useSpring(ry, { stiffness: 260, damping: 24 });

  function handleMouseMove(e: React.MouseEvent<HTMLAnchorElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    e.currentTarget.style.setProperty("--mx", `${Math.round(px * 100)}%`);
    e.currentTarget.style.setProperty("--my", `${Math.round(py * 100)}%`);
    if (!reduced) {
      rx.set((0.5 - py) * 10);
      ry.set((px - 0.5) * 10);
    }
  }

  function handleMouseLeave() {
    rx.set(0);
    ry.set(0);
  }

  return (
    <motion.div style={{ perspective: 900, rotateX: springRx, rotateY: springRy }}>
      <Link
        href={href}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="tilt-glow group flex h-full flex-col justify-between rounded-2xl border border-slate-800/90 bg-[#0c1224]/80 p-5 transition hover:border-[#4f7cff]/60"
      >
        {children}
      </Link>
    </motion.div>
  );
}

export function ShowcaseCards({ authed }: { authed: boolean }) {
  return (
    <div className="mx-auto mt-10 grid max-w-5xl gap-4 text-left md:grid-cols-3">
      {/* Card 1: Template & Showcase */}
      <TiltCard href="/templates">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#35d6ff]">Starter Kit</span>
            <span className="rounded-full border border-[#35d6ff]/40 bg-[#35d6ff]/15 px-2 py-0.5 text-[10px] font-semibold text-[#7fe3ff]">
              Baru
            </span>
          </div>
          <div className="mt-3 rounded-xl border border-slate-800/80 bg-[#070b16] p-3">
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  style={{ animationDelay: `${i * 180}ms` }}
                  className="skeleton-line h-7 rounded-lg border border-slate-800/80 bg-linear-to-br from-slate-800/80 to-slate-900"
                />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-white group-hover:text-[#7fe3ff]">Template & Showcase</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Prompt install siap tempel untuk Next.js, TanStack, & FastAPI.
          </p>
        </div>
      </TiltCard>

      {/* Card 2: AI tanya dulu */}
      <TiltCard href="#cara-kerja">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#a78bfa]">Klarifikasi</span>
            <span className="text-[11px] text-slate-500">Maks 3 tanya</span>
          </div>
          <div className="mt-3 space-y-2 rounded-xl border border-slate-800/80 bg-[#070b16] p-3 text-[11px]">
            <div className="ml-auto w-4/5 rounded-lg bg-[#4f7cff]/25 px-2.5 py-1.5 text-slate-200">
              Bikinin PRD aplikasi kasir kopi
            </div>
            <div className="w-4/5 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1.5 text-slate-300">
              Siapa kasirnya & apakah butuh QRIS?
            </div>
            <div className="flex w-14 items-center justify-center gap-1 rounded-lg border border-slate-800 bg-slate-900/90 px-2 py-1.5">
              <span className="dots-wave flex gap-1">
                <span className="h-1 w-1 rounded-full bg-[#35d6ff]" />
                <span className="h-1 w-1 rounded-full bg-[#35d6ff]" />
                <span className="h-1 w-1 rounded-full bg-[#35d6ff]" />
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-white group-hover:text-[#7fe3ff]">AI tanya dulu</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Bukan nebak-nebak: AI menggali target user, fitur wajib, dan batasan.
          </p>
        </div>
      </TiltCard>

      {/* Card 3: PRD + Task breakdown */}
      <TiltCard href={authed ? "/dashboard" : "/register"}>
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-300">Siap eksekusi</span>
            <span className="font-mono text-[10px] text-slate-500">12 bagian</span>
          </div>
          <div className="mt-3 space-y-2 rounded-xl border border-slate-800/80 bg-[#070b16] p-3 text-[11px]">
            {[
              { id: "T1", label: "Setup schema & auth", done: true },
              { id: "T2", label: "Endpoint API & SSE", done: true },
              { id: "T3", label: "UI komponen + export", done: false },
            ].map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <span
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[9px] ${
                    item.done
                      ? "border-emerald-400/60 bg-emerald-400/20 text-emerald-300"
                      : "border-slate-700 text-slate-500"
                  }`}
                >
                  {item.done ? "✓" : ""}
                </span>
                <span className="font-mono text-[10px] text-[#35d6ff]">{item.id}</span>
                <span className={item.done ? "text-slate-400 line-through" : "text-slate-200"}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-white group-hover:text-[#7fe3ff]">PRD + Task breakdown</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Export .md, .pdf, atau JSON siap tempel ke Claude Code & Cursor.
          </p>
        </div>
      </TiltCard>
    </div>
  );
}
