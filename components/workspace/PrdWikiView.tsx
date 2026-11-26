"use client";

import { useEffect, useMemo, useState } from "react";
import { extractHeadings, MarkdownView } from "../MarkdownView";

interface PrdWikiViewProps {
  prd: string;
  onSavePrd: (nextPrd: string) => Promise<void>;
  saving?: boolean;
}

export function PrdWikiView({ prd, onSavePrd, saving = false }: PrdWikiViewProps) {
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [editorText, setEditorText] = useState(prd);
  const [activeId, setActiveId] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);

  const headings = useMemo(() => extractHeadings(prd), [prd]);
  const resolvedActiveId = activeId || headings[0]?.id || "";

  useEffect(() => {
    if (mode !== "preview" || headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible?.target.id) {
          setActiveId(visible.target.id);
        }
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0.05 },
    );

    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [headings, mode]);

  function scrollToHeading(id: string) {
    setActiveId(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function handleSave() {
    await onSavePrd(editorText);
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 1800);
    setMode("preview");
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Left Sticky Outline / TOC */}
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-slate-800/80 bg-[#080d1b] p-4 lg:block print:hidden">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Daftar Isi Wiki
        </p>
        <nav aria-label="Outline dokumen PRD" className="mt-3 space-y-1">
          {headings.length === 0 ? (
            <p className="text-xs text-slate-500">Belum ada bagian heading.</p>
          ) : (
            headings.map((h) => {
              const active = resolvedActiveId === h.id;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => scrollToHeading(h.id)}
                  className={`block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                    h.level === 3 ? "pl-5 text-[11px]" : "font-medium"
                  } ${
                    active
                      ? "border border-[#35d6ff]/40 bg-[#35d6ff]/12 text-[#7fe3ff]"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`}
                >
                  {h.text}
                </button>
              );
            })
          )}
        </nav>
      </aside>

      {/* Main Wiki Document */}
      <div className="min-w-0 flex-1 overflow-y-auto bg-[#070a14] p-4 sm:p-6">
        <div className="mx-auto max-w-4xl">
          {/* Wiki Toolbar */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/80 bg-[#0d1326]/80 px-3.5 py-2.5 print:hidden">
            <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950/70 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMode("preview")}
                className={`rounded-md px-3 py-1 font-medium transition ${
                  mode === "preview"
                    ? "bg-[#35d6ff]/20 text-[#7fe3ff]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Pratinjau
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditorText(prd);
                  setMode("edit");
                }}
                className={`rounded-md px-3 py-1 font-mono font-medium transition ${
                  mode === "edit"
                    ? "bg-[#35d6ff]/20 text-[#7fe3ff]"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                &lt;/&gt; Editor
              </button>
            </div>

            <div className="flex items-center gap-2">
              {savedNotice ? (
                <span className="text-xs text-emerald-300">Tersimpan ✓</span>
              ) : null}
              {mode === "edit" ? (
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="rounded-lg bg-linear-to-r from-[#4f7cff] to-[#35d6ff] px-3.5 py-1.5 text-xs font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-60"
                >
                  {saving ? "Menyimpan…" : "Simpan Perubahan"}
                </button>
              ) : null}
            </div>
          </div>

          {mode === "edit" ? (
            <textarea
              value={editorText}
              onChange={(e) => setEditorText(e.target.value)}
              rows={28}
              aria-label="Editor Markdown PRD"
              className="w-full rounded-2xl border border-slate-800 bg-[#0a0f1f] p-4 font-mono text-xs leading-relaxed text-slate-200 focus:border-[#35d6ff] focus:outline-none"
            />
          ) : (
            <article className="print-area rounded-2xl border border-slate-800/80 bg-[#0a0f1f]/80 p-5 shadow-xl sm:p-8">
              <MarkdownView content={prd} />
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
