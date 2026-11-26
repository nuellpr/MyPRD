"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

export function CopyButton({ text, label = "Salin prompt install" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const reduced = useReducedMotion();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ponytail: tanpa fallback execCommand — Clipboard API butuh secure context
      // (HTTPS/localhost). Upgrade path: tampilkan pesan "salin manual" bila gagal.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`btn-shine relative overflow-hidden rounded-xl px-5 py-2.5 text-sm font-semibold transition active:scale-[0.98] ${
        copied
          ? "bg-emerald-400 text-slate-950"
          : "bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] text-slate-950 hover:brightness-110"
      }`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? "copied" : "idle"}
          initial={reduced ? { opacity: 1 } : { opacity: 0, y: 6 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: reduced ? 0.01 : 0.16 }}
          className="inline-flex items-center gap-1.5"
        >
          {copied ? "Disalin ✓" : label}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
