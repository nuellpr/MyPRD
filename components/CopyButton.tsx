"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Salin prompt install" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

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
      className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition ${
        copied ? "bg-emerald-500 text-slate-950" : "bg-linear-to-r from-sky-500 to-violet-400 text-slate-950 hover:brightness-110"
      }`}
    >
      {copied ? "✓ Tersalin!" : label}
    </button>
  );
}
