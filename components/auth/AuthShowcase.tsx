"use client";

import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import Image from "next/image";
import { useEffect, useState } from "react";

const TAGLINES = [
  "Ide → PRD → Task, dalam hitungan menit",
  "AI tanya dulu, nggak nebak-nebak",
  "Siap tempel ke Claude Code & Cursor",
];

export function AuthShowcase() {
  const reduced = useReducedMotion();
  const [taglineIdx, setTaglineIdx] = useState(0);

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 120, damping: 20 });
  const sy = useSpring(py, { stiffness: 120, damping: 20 });
  const sxBack = useSpring(px, { stiffness: 80, damping: 24 });
  const syBack = useSpring(py, { stiffness: 80, damping: 24 });

  useEffect(() => {
    if (reduced) return;
    const timer = window.setInterval(() => {
      setTaglineIdx((i) => (i + 1) % TAGLINES.length);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [reduced]);

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    px.set(nx * 24);
    py.set(ny * 20);
  }

  function onPointerLeave() {
    px.set(0);
    py.set(0);
  }

  return (
    <div
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="relative hidden flex-col justify-between overflow-hidden rounded-3xl border border-slate-800/80 bg-[#080d1d]/80 p-8 lg:flex"
    >
      {/* Aurora blobs + grid */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-grid-pattern absolute inset-0 opacity-60" />
        <div
          className="aurora-blob absolute -top-24 -left-16 h-72 w-72 rounded-full opacity-45 blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(79,124,255,0.65), transparent)" }}
        />
        <div
          className="aurora-blob absolute right-0 -bottom-24 h-80 w-80 rounded-full opacity-40 blur-3xl"
          style={{
            background: "radial-gradient(closest-side, rgba(167,139,250,0.6), transparent)",
            animationDelay: "-6s",
          }}
        />
      </div>

      {/* Top Brand */}
      <div className="relative z-10 flex items-center gap-3">
        <Image
          src="/logo-mark.png"
          alt=""
          width={520}
          height={430}
          priority
          className="float-y logo-glow h-11 w-auto rounded-xl"
        />
        <div>
          <p className="text-lg font-bold tracking-tight text-white">
            My<span className="bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] bg-clip-text text-transparent">PRD</span>
          </p>
          <p className="text-xs text-slate-400">Workspace PRD untuk AI coding agent</p>
        </div>
      </div>

      {/* 3 Floating Glass Cards */}
      <div className="relative z-10 my-10 space-y-4">
        {/* Card 1: Chat bubble */}
        <motion.div
          style={{ x: sx, y: sy }}
          className="ml-auto max-w-xs rounded-2xl border border-slate-700/70 bg-[#0d142a]/85 p-4 shadow-xl backdrop-blur-md"
        >
          <p className="text-[11px] font-medium text-[#35d6ff]">Obrolan AI</p>
          <div className="mt-2 rounded-xl bg-linear-to-r from-[#4f7cff]/25 to-[#35d6ff]/20 px-3 py-2 text-xs text-slate-100">
            Bikinin PRD aplikasi kasir kopi ☕
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">
            <span className="dots-wave flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#35d6ff]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#35d6ff]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#35d6ff]" />
            </span>
            <span className="text-slate-400">Siap! Target kasirnya berapa outlet?</span>
          </div>
        </motion.div>

        {/* Card 2: PRD skeleton doc */}
        <motion.div
          style={{ x: sxBack, y: syBack }}
          className="max-w-sm rounded-2xl border border-slate-700/70 bg-[#0d142a]/85 p-4 shadow-xl backdrop-blur-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white">PRD — Kasir Kopi</span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">12 bagian</span>
          </div>
          <div className="mt-3 space-y-2">
            <div className="skeleton-line h-2 w-4/5 rounded-full bg-linear-to-r from-[#4f7cff]/50 to-[#35d6ff]/50" />
            <div
              className="skeleton-line h-2 w-full rounded-full bg-slate-800"
              style={{ animationDelay: "300ms" }}
            />
            <div
              className="skeleton-line h-2 w-2/3 rounded-full bg-slate-800"
              style={{ animationDelay: "600ms" }}
            />
          </div>
        </motion.div>

        {/* Card 3: Task checklist */}
        <motion.div
          style={{ x: sx, y: sy }}
          className="ml-8 max-w-xs rounded-2xl border border-slate-700/70 bg-[#0d142a]/85 p-4 shadow-xl backdrop-blur-md"
        >
          <p className="text-[11px] font-medium text-[#a78bfa]">Task Breakdown</p>
          <ul className="mt-2 space-y-1.5 text-xs">
            <li className="flex items-center gap-2 text-slate-300">
              <span className="text-emerald-400">✓</span>
              <span className="font-mono text-[11px] text-[#35d6ff]">T1</span> Setup Next.js
            </li>
            <li className="flex items-center gap-2 text-slate-300">
              <span className="text-emerald-400">✓</span>
              <span className="font-mono text-[11px] text-[#35d6ff]">T2</span> Auth + OTP
            </li>
            <li className="flex items-center gap-2 text-slate-400">
              <span className="inline-block h-3 w-3 rounded border border-slate-600" />
              <span className="font-mono text-[11px] text-[#35d6ff]">T3</span> Dashboard
            </li>
          </ul>
        </motion.div>
      </div>

      {/* Rotating tagline */}
      <div className="relative z-10 h-12">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={taglineIdx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: reduced ? 0.01 : 0.3 }}
            className="text-sm font-medium text-slate-200"
          >
            {TAGLINES[taglineIdx]}
          </motion.p>
        </AnimatePresence>
        <div className="mt-2 flex gap-1.5">
          {TAGLINES.map((_, idx) => (
            <span
              key={idx}
              className={`h-1 rounded-full transition-all duration-300 ${
                idx === taglineIdx ? "w-6 bg-[#35d6ff]" : "w-2 bg-slate-700"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
