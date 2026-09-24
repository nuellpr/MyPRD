"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:border-red-500/60 hover:text-red-300 disabled:opacity-50"
    >
      {busy ? "Keluar..." : "Keluar"}
    </button>
  );
}
