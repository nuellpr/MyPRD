"use client";

import { IconArrowRight } from "@/components/icons";

export type SubmitStatus = "idle" | "loading" | "success";

export function SubmitButton({
  status = "idle",
  idleLabel,
  loadingLabel = "Memproses...",
  successLabel = "Berhasil",
  disabled,
  className = "",
}: {
  status?: SubmitStatus;
  idleLabel: string;
  loadingLabel?: string;
  successLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const isBusy = status === "loading" || status === "success";

  return (
    <button
      type="submit"
      disabled={disabled || isBusy}
      className={`btn-shine flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-70 ${
        status === "success"
          ? "bg-emerald-400 text-slate-950"
          : "bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] text-slate-950 shadow-lg shadow-[#35d6ff]/20 hover:brightness-110"
      } ${className}`}
    >
      {status === "loading" ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
          <span>{loadingLabel}</span>
        </>
      ) : status === "success" ? (
        <>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path d="M5 13l4 4L19 7" className="draw-check" />
          </svg>
          <span>{successLabel}</span>
        </>
      ) : (
        <>
          <span>{idleLabel}</span>
          <IconArrowRight className="h-4 w-4" />
        </>
      )}
    </button>
  );
}
