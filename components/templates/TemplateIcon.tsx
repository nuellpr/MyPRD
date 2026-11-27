"use client";

import { motion, useReducedMotion } from "motion/react";

interface ThemePalette {
  shell: string;
  glow: string;
}

const THEMES: Record<string, ThemePalette> = {
  "next-starter": {
    shell: "border-sky-400/35 bg-linear-to-br from-[#0e1938] via-[#0b132b] to-[#172554]",
    glow: "bg-sky-400/25",
  },
  "tanstack-starter": {
    shell: "border-emerald-400/35 bg-linear-to-br from-[#082529] via-[#0a1829] to-[#0f2942]",
    glow: "bg-emerald-400/25",
  },
  "fastapi-starter": {
    shell: "border-cyan-400/35 bg-linear-to-br from-[#082436] via-[#0b152a] to-[#0d2f3f]",
    glow: "bg-cyan-400/25",
  },
  "laravel-starter": {
    shell: "border-rose-400/35 bg-linear-to-br from-[#2d1020] via-[#170d23] to-[#2e161d]",
    glow: "bg-rose-400/25",
  },
  "expo-starter": {
    shell: "border-violet-400/35 bg-linear-to-br from-[#1d113a] via-[#10142f] to-[#162749]",
    glow: "bg-violet-400/25",
  },
};

const DEFAULT_THEME: ThemePalette = {
  shell: "border-slate-700/80 bg-linear-to-br from-slate-900 to-slate-950",
  glow: "bg-sky-400/20",
};

/** Ikon template SVG berlapis dengan animasi spring & pulse. */
export function TemplateIcon({ slug, className = "" }: { slug: string; className?: string }) {
  const reduced = Boolean(useReducedMotion());
  const theme = THEMES[slug] ?? DEFAULT_THEME;

  return (
    <motion.span
      whileHover={reduced ? undefined : { scale: 1.08, rotate: -3 }}
      transition={{ type: "spring", stiffness: 360, damping: 20 }}
      className={`relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border shadow-lg ${theme.shell} ${className}`}
    >
      <motion.span
        aria-hidden="true"
        animate={reduced ? undefined : { opacity: [0.35, 0.85, 0.35], scale: [0.9, 1.15, 0.9] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        className={`pointer-events-none absolute inset-1.5 rounded-xl blur-md ${theme.glow}`}
      />
      <TemplateSvg slug={slug} reduced={reduced} />
    </motion.span>
  );
}

function TemplateSvg({ slug, reduced }: { slug: string; reduced: boolean }) {
  switch (slug) {
    case "next-starter":
      return (
        <svg viewBox="0 0 36 36" className="relative h-8 w-8" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="tpl-next" x1="6" y1="6" x2="30" y2="30" gradientUnits="userSpaceOnUse">
              <stop stopColor="#e0f2fe" />
              <stop offset="1" stopColor="#38bdf8" />
            </linearGradient>
          </defs>
          <motion.circle
            cx="18"
            cy="18"
            r="14"
            stroke="url(#tpl-next)"
            strokeOpacity="0.45"
            strokeWidth="1.2"
            strokeDasharray="4 3"
            animate={reduced ? undefined : { rotate: 360 }}
            transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
            style={{ originX: "18px", originY: "18px" }}
          />
          <motion.path
            d="M12.5 24.5V11.5L24.5 26"
            stroke="url(#tpl-next)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={reduced ? undefined : { opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <path d="M23.5 11.5v7.5" stroke="#7fe3ff" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );

    case "tanstack-starter":
      return (
        <svg viewBox="0 0 36 36" className="relative h-8 w-8" fill="none" aria-hidden="true">
          <motion.path
            d="M18 21.5 28 26.5 18 31 8 26.5l10-5Z"
            fill="#14b8a6"
            fillOpacity="0.22"
            stroke="#2dd4bf"
            strokeWidth="1.7"
            strokeLinejoin="round"
            animate={reduced ? undefined : { y: [0, 1.5, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            d="M18 14.5 28 19.5 18 24 8 19.5l10-5Z"
            fill="#34d399"
            fillOpacity="0.28"
            stroke="#5eead4"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <motion.path
            d="M18 6.5 28 11.5 18 16.5 8 11.5 18 6.5Z"
            fill="#6ee7b7"
            fillOpacity="0.38"
            stroke="#a7f3d0"
            strokeWidth="1.8"
            strokeLinejoin="round"
            animate={reduced ? undefined : { y: [0, -2, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>
      );

    case "fastapi-starter":
      return (
        <svg viewBox="0 0 36 36" className="relative h-8 w-8" fill="none" aria-hidden="true">
          <motion.circle
            cx="18"
            cy="18"
            r="13"
            stroke="#22d3ee"
            strokeWidth="1.4"
            strokeOpacity="0.45"
            animate={reduced ? undefined : { scale: [0.88, 1.08, 0.88], opacity: [0.65, 0.2, 0.65] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            style={{ originX: "18px", originY: "18px" }}
          />
          <motion.path
            d="M19.5 6.5 10.5 19.5h7l-1 10 9-13h-7l1-10Z"
            fill="#22d3ee"
            fillOpacity="0.26"
            stroke="#67e8f9"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={reduced ? undefined : { scale: [1, 1.07, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            style={{ originX: "18px", originY: "18px" }}
          />
        </svg>
      );

    case "laravel-starter":
      return (
        <svg viewBox="0 0 36 36" className="relative h-8 w-8" fill="none" aria-hidden="true">
          <motion.g
            animate={reduced ? undefined : { y: [0, -1.8, 0] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <path
              d="m18 6.5 10 5.5v12l-10 5.5-10-5.5V12l10-5.5Z"
              fill="#fb7185"
              fillOpacity="0.2"
              stroke="#fda4af"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="m8 12 10 5.5 10-5.5M18 17.5v12" stroke="#fb7185" strokeWidth="1.7" strokeLinejoin="round" />
          </motion.g>
          <motion.circle
            cx="18"
            cy="17.5"
            r="2.4"
            fill="#fda4af"
            animate={reduced ? undefined : { opacity: [0.6, 1, 0.6], scale: [0.85, 1.2, 0.85] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            style={{ originX: "18px", originY: "17.5px" }}
          />
        </svg>
      );

    case "expo-starter":
      return (
        <svg viewBox="0 0 36 36" className="relative h-8 w-8" fill="none" aria-hidden="true">
          <motion.path
            d="M11 11.5a10.5 10.5 0 0 1 14 0"
            stroke="#c4b5fd"
            strokeWidth="1.6"
            strokeLinecap="round"
            animate={reduced ? undefined : { opacity: [0.3, 1, 0.3], y: [1, -1, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            d="M8.5 25.5 16.4 12.6a1.9 1.9 0 0 1 3.2 0l7.9 12.9"
            stroke="#a78bfa"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={reduced ? undefined : { scale: [1, 1.04, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            style={{ originX: "18px", originY: "20px" }}
          />
          <motion.circle
            cx="18"
            cy="24.5"
            r="2"
            fill="#38bdf8"
            animate={reduced ? undefined : { opacity: [0.65, 1, 0.65] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 36 36" className="relative h-8 w-8" fill="none" aria-hidden="true">
          <path
            d="m18 6 10 5.8v12.4L18 30 8 24.2V11.8L18 6Z"
            fill="#38bdf8"
            fillOpacity="0.2"
            stroke="#7fe3ff"
            strokeWidth="1.8"
          />
        </svg>
      );
  }
}
