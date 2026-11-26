"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteProjectButton({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    if (!confirming) {
      setConfirming(true);
      window.setTimeout(() => setConfirming(false), 3000);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => void handleDelete(e)}
      disabled={busy}
      aria-label={`Hapus project ${projectTitle}`}
      className={`rounded-lg border px-2 py-0.5 text-[11px] font-medium transition disabled:opacity-50 ${
        confirming
          ? "border-rose-500/70 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"
          : "border-slate-800 bg-slate-900/70 text-slate-400 hover:border-rose-500/50 hover:text-rose-300"
      }`}
    >
      {busy ? "Menghapus…" : confirming ? "Yakin hapus?" : "Hapus"}
    </button>
  );
}
