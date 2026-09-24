"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Salin prompt install" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback untuk browser lama: seleksi manual via textarea sementara.
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition ${
        copied ? "bg-emerald-500 text-slate-950" : "bg-sky-500 text-slate-950 hover:bg-sky-400"
      }`}
    >
      {copied ? "✓ Tersalin!" : label}
    </button>
  );
}
