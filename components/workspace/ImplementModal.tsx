"use client";

import { useEffect, useMemo, useState } from "react";
import { buildImplementationPrompt } from "@/lib/prd";
import type { ParsedTask } from "@/lib/tasks";
import { IconCheck, IconSparkles } from "../icons";

interface ImplementModalProps {
  open: boolean;
  projectId: string;
  projectTitle: string;
  prd: string;
  tasks: ParsedTask[];
  onClose: () => void;
}

interface AgentSyncState {
  projectId: string;
  token: string;
  webhookUrl: string;
}

export function ImplementModal({
  open,
  projectId,
  projectTitle,
  prd,
  tasks,
  onClose,
}: ImplementModalProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [syncState, setSyncState] = useState<AgentSyncState | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    if (!open || syncState?.projectId === projectId) return;
    let cancelled = false;
    fetch(`/api/projects/${projectId}/agent-token`)
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          token?: string;
          webhookUrl?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.token || !data.webhookUrl) {
          setSyncError(data.error ?? "Gagal menyiapkan token Live Sync.");
          return;
        }
        setSyncError("");
        setSyncState({ projectId, token: data.token, webhookUrl: data.webhookUrl });
      })
      .catch(() => {
        if (!cancelled) setSyncError("Tidak bisa menghubungi server untuk Live Sync.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId, syncState?.projectId]);

  const activeSync = syncState?.projectId === projectId ? syncState : null;
  const isFetchingInitial = open && !activeSync && !syncError;

  const promptText = useMemo(
    () => buildImplementationPrompt(projectTitle, prd, tasks, activeSync),
    [projectTitle, prd, tasks, activeSync],
  );

  if (!open) return null;

  async function rotateToken() {
    if (syncLoading || isFetchingInitial) return;
    setSyncLoading(true);
    setSyncError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/agent-token`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        token?: string;
        webhookUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.token || !data.webhookUrl) {
        setSyncError(data.error ?? "Gagal mereset token agent.");
        return;
      }
      setSyncState({ projectId, token: data.token, webhookUrl: data.webhookUrl });
      setCopied(false);
    } catch {
      setSyncError("Tidak bisa menghubungi server saat mereset token.");
    } finally {
      setSyncLoading(false);
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Abaikan clipboard error.
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="implement-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700/80 bg-[#0b1022] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-linear-to-br from-[#4f7cff] to-[#35d6ff] text-slate-950">
              <IconSparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 id="implement-modal-title" className="text-base font-semibold text-white">
                Mulai implementasi dengan AI agent
              </h2>
              <p className="text-xs text-slate-400">
                Siap dijalankan di Cursor, Windsurf, Claude Code, Antigravity, atau Codex.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal implementasi"
            className="rounded-lg border border-slate-800 px-2.5 py-1 text-sm text-slate-400 hover:border-slate-600 hover:text-white"
          >
            ×
          </button>
        </div>

        {/* 3-step instructions */}
        <ol className="mt-4 grid gap-2.5 sm:grid-cols-3">
          {[
            { num: "1", title: "Salin prompt", desc: "Sudah berisi PRD lengkap & task terurut." },
            { num: "2", title: "Buka AI coding", desc: "Tempel prompt ke editor / CLI favoritmu." },
            { num: "3", title: "Lacak progres", desc: "Status task di Roadmap & Kanban ter-update otomatis." },
          ].map((step) => (
            <li
              key={step.num}
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs"
            >
              <span className="inline-grid h-5 w-5 place-items-center rounded-full bg-[#35d6ff]/20 font-semibold text-[#7fe3ff]">
                {step.num}
              </span>
              <p className="mt-1.5 font-semibold text-slate-100">{step.title}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{step.desc}</p>
            </li>
          ))}
        </ol>

        {/* Live Sync token status + Copy prompt */}
        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/80 p-3.5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5 text-[11px]">
            <div className="flex items-center gap-2 text-slate-300">
              <span
                className={`h-2 w-2 rounded-full ${
                  activeSync
                    ? "bg-emerald-400"
                    : syncError
                      ? "bg-amber-400"
                      : "bg-slate-500 animate-pulse"
                }`}
              />
              <span>
                {activeSync
                  ? "Live Sync aktif — perintah webhook sudah disisipkan di prompt"
                  : syncError
                    ? syncError
                    : "Menyiapkan token Live Sync…"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => void rotateToken()}
              disabled={syncLoading || isFetchingInitial}
              className="rounded-lg border border-slate-700/80 bg-slate-900 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-50"
            >
              {syncLoading ? "Mereset…" : "Reset Token"}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs font-medium text-[#35d6ff] hover:underline"
            >
              {expanded ? "Sembunyikan isi prompt ▲" : "Lihat isi prompt lengkap ▼"}
            </button>

            <button
              type="button"
              onClick={() => void copyPrompt()}
              disabled={syncLoading || isFetchingInitial}
              className="btn-shine inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] px-4 py-2 text-xs font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50"
            >
              {copied ? (
                <>
                  <IconCheck className="h-3.5 w-3.5" />
                  <span>Prompt Tersalin!</span>
                </>
              ) : (
                <span>Salin Prompt AI Agent</span>
              )}
            </button>
          </div>

          {expanded ? (
            <pre className="mt-3 max-h-60 overflow-auto rounded-lg border border-slate-800 bg-[#070a14] p-3 font-mono text-[11px] leading-relaxed text-slate-300">
              {promptText}
            </pre>
          ) : null}
        </div>

        {/* Export options */}
        <div className="mt-5 border-t border-slate-800 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Ekspor File Project
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {[
              { format: "markdown", label: "PRD (.md)" },
              { format: "tasks-md", label: "tasks.md" },
              { format: "tasks-json", label: "tasks.json" },
              { format: "pdf", label: "Dokumen (.pdf)" },
            ].map((item) => (
              <a
                key={item.format}
                href={`/api/projects/${projectId}/export?format=${item.format}`}
                className="rounded-lg border border-slate-700/80 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-[#35d6ff]/60 hover:text-white"
              >
                Unduh {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
