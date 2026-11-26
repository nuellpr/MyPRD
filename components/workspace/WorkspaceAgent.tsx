"use client";

import { useState } from "react";
import { IconSparkles } from "../icons";
import { MarkdownView } from "../MarkdownView";

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

interface WorkspaceAgentProps {
  messages: AgentMessage[];
  featureCount: number;
  subFeatureCount: number;
  taskCount: number;
  streaming: boolean;
  streamText: string;
  error: string;
  onSend: (mode: "revise" | "chat", text: string) => Promise<void>;
  onClose: () => void;
}

const QUICK_REVISIONS = [
  "Tambah role admin & audit log",
  "Tambah integrasi QRIS / midtrans",
  "Pecah task modul utama lebih detail",
  "Perketat validasi & keamanan API",
];

export function WorkspaceAgent({
  messages,
  featureCount,
  subFeatureCount,
  taskCount,
  streaming,
  streamText,
  error,
  onSend,
  onClose,
}: WorkspaceAgentProps) {
  const [mode, setMode] = useState<"revise" | "chat">("revise");
  const [input, setInput] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    await onSend(mode, text);
  }

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-l border-slate-800/80 bg-[#080c19] lg:w-[310px] xl:w-[340px] print:hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#35d6ff]/15 text-[#35d6ff]">
            <IconSparkles className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-xs font-semibold text-white">Workspace Agent</h2>
            <p className="text-[11px] text-slate-400">Revisi PRD &amp; diskusi arsitektur</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup Workspace Agent"
          className="rounded-lg border border-slate-800 px-2 py-1 text-xs text-slate-400 transition hover:border-slate-600 hover:text-white"
        >
          ×
        </button>
      </div>

      {/* Ringkasan Struktur */}
      <div className="border-b border-slate-800/80 bg-[#0d1326]/70 px-4 py-2.5 text-xs text-slate-300">
        <span className="font-semibold text-[#7fe3ff]">{featureCount} fitur</span>,{" "}
        <span className="font-semibold text-slate-100">{subFeatureCount} sub-fitur</span>, dan{" "}
        <span className="font-semibold text-emerald-300">{taskCount} task</span> siap dikerjakan.
      </div>

      {/* Message List */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !streaming ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 text-xs leading-relaxed text-slate-400">
            Minta Workspace Agent merevisi fitur, diagram, skema database, atau daftar task secara langsung di dokumen PRD ini.
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl border px-3 py-2.5 text-xs ${
                m.role === "user"
                  ? "ml-6 border-[#4f7cff]/40 bg-[#4f7cff]/12 text-slate-100"
                  : "mr-3 border-slate-800 bg-[#0d1326] text-slate-200"
              }`}
            >
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {m.role === "user" ? "Anda" : "Workspace Agent"}
              </p>
              {m.role === "assistant" ? (
                <MarkdownView content={m.content} className="text-xs" />
              ) : (
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              )}
            </div>
          ))
        )}

        {streaming ? (
          <div className="mr-3 rounded-xl border border-[#35d6ff]/40 bg-[#0d1326] p-3 text-xs text-slate-200">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#7fe3ff]">
              Memperbarui…
            </p>
            {streamText ? (
              <p className="line-clamp-6 whitespace-pre-wrap font-mono text-[11px] text-slate-400">
                {streamText}
              </p>
            ) : (
              <p className="text-slate-400">AI sedang memproses permintaanmu…</p>
            )}
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 p-2.5 text-xs text-red-300">
            {error}
          </p>
        ) : null}
      </div>

      {/* Composer */}
      <form onSubmit={(e) => void handleSubmit(e)} className="border-t border-slate-800/80 p-3">
        <div className="mb-2 inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setMode("revise")}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              mode === "revise"
                ? "bg-[#35d6ff]/20 text-[#7fe3ff]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            ✨ Revisi PRD
          </button>
          <button
            type="button"
            onClick={() => setMode("chat")}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              mode === "chat"
                ? "bg-[#a78bfa]/20 text-violet-200"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            💬 Diskusi
          </button>
        </div>

        {mode === "revise" ? (
          <div className="mb-2 flex flex-wrap gap-1">
            {QUICK_REVISIONS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setInput(chip)}
                className="rounded-full border border-slate-800 bg-slate-900/70 px-2 py-0.5 text-[10px] text-slate-300 transition hover:border-[#35d6ff]/50 hover:text-white"
              >
                {chip}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-end gap-2 rounded-xl border border-slate-800 bg-slate-950/90 p-2 focus-within:border-[#35d6ff]">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit(e);
              }
            }}
            placeholder={
              mode === "revise"
                ? "Instruksikan perubahan PRD (misal: tambah fitur wishlist)…"
                : "Tanyakan detail teknis ke agent…"
            }
            className="min-h-[42px] flex-1 resize-none bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="rounded-lg bg-linear-to-r from-[#4f7cff] to-[#35d6ff] px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-40"
          >
            Kirim
          </button>
        </div>
      </form>
    </aside>
  );
}
