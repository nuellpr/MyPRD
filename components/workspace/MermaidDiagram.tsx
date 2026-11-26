"use client";

import { useEffect, useId, useRef, useState } from "react";

let mermaidInitialized = false;

function cleanupMermaidDom(renderId: string, container: HTMLElement | null) {
  document.getElementById(`d${renderId}`)?.remove();
  const orphan = document.getElementById(renderId);
  if (orphan && (!container || !container.contains(orphan))) {
    orphan.remove();
  }
}

export function MermaidDiagram({ code }: { code: string }) {
  const reactId = useId();
  const safeId = `mmd_${reactId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);
  const [renderState, setRenderState] = useState<{ code: string; error: string }>({
    code: "",
    error: "",
  });

  const error = renderState.code === code ? renderState.error : "";
  const loading = renderState.code !== code;

  useEffect(() => {
    let cancelled = false;
    const trimmed = code.trim();
    const uniqueRenderId = `${safeId}_${Date.now()}`;
    const containerEl = containerRef.current;

    const timer = window.setTimeout(() => {
      async function renderDiagram() {
        if (!trimmed) {
          if (!cancelled) {
            setRenderState({ code, error: "Blok diagram kosong." });
          }
          return;
        }

        try {
          const mod = await import("mermaid");
          const mermaid = mod.default;
          if (!mermaidInitialized) {
            mermaid.initialize({
              startOnLoad: false,
              suppressErrorRendering: true,
              theme: "dark",
              securityLevel: "strict",
              fontFamily: "ui-sans-serif, system-ui, sans-serif",
              themeVariables: {
                background: "#070a14",
                primaryColor: "#142042",
                primaryTextColor: "#e2e8f0",
                primaryBorderColor: "#35d6ff",
                lineColor: "#60a5fa",
                secondaryColor: "#0f172a",
                tertiaryColor: "#1e1b4b",
              },
            });
            mermaidInitialized = true;
          }

          // Validasi sintaks sebelum render agar Mermaid tidak menyisipkan bomb SVG ke DOM global.
          const valid = await mermaid.parse(trimmed, { suppressErrors: true });
          if (cancelled) return;
          if (!valid) {
            setRenderState({ code, error: "Sintaks diagram Mermaid belum valid." });
            return;
          }

          const { svg } = await mermaid.render(uniqueRenderId, trimmed);
          if (cancelled) return;
          if (svg.includes("Syntax error in text")) {
            setRenderState({ code, error: "Sintaks diagram Mermaid belum valid." });
            return;
          }
          if (containerEl) {
            containerEl.innerHTML = svg;
            const svgEl = containerEl.querySelector("svg");
            if (svgEl) {
              svgEl.style.maxWidth = "100%";
              svgEl.style.height = "auto";
            }
          }
          setRenderState({ code, error: "" });
        } catch (err) {
          if (cancelled) return;
          setRenderState({
            code,
            error: err instanceof Error ? err.message : "Diagram Mermaid belum valid.",
          });
        } finally {
          cleanupMermaidDom(uniqueRenderId, containerEl);
        }
      }

      void renderDiagram();
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cleanupMermaidDom(uniqueRenderId, containerEl);
    };
  }, [code, safeId]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Abaikan clipboard error.
    }
  }

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-slate-800 bg-[#070a14] shadow-lg">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/90 bg-slate-900/70 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#35d6ff]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            Diagram Mermaid
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {!showSource && !error ? (
            <div className="mr-1 inline-flex items-center rounded-lg border border-slate-700/80 bg-slate-950/70 p-0.5 text-[11px] text-slate-300">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
                aria-label="Perkecil diagram"
                className="rounded px-2 py-0.5 hover:bg-slate-800 hover:text-white"
              >
                −
              </button>
              <span className="min-w-[42px] text-center tabular-nums text-slate-400">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2, Number((z + 0.15).toFixed(2))))}
                aria-label="Perbesar diagram"
                className="rounded px-2 py-0.5 hover:bg-slate-800 hover:text-white"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="rounded px-2 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                Reset
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void copyCode()}
            className="rounded-lg border border-slate-700/80 bg-slate-950/70 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            {copied ? "Disalin ✓" : "Salin"}
          </button>

          <button
            type="button"
            onClick={() => setShowSource((v) => !v)}
            className={`rounded-lg border px-2.5 py-1 font-mono text-[11px] transition ${
              showSource
                ? "border-[#35d6ff]/70 bg-[#35d6ff]/15 text-[#7fe3ff]"
                : "border-slate-700/80 bg-slate-950/70 text-slate-300 hover:border-slate-500 hover:text-white"
            }`}
            title="Toggle source code Mermaid"
          >
            &lt;/&gt;
          </button>
        </div>
      </div>

      {/* Body */}
      {showSource || error ? (
        <div className="p-3">
          {error ? (
            <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
              Pratinjau visual tidak bisa dirender ({error}). Menampilkan source Mermaid:
            </p>
          ) : null}
          <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-300">
            <code>{code}</code>
          </pre>
        </div>
      ) : (
        <div className="relative min-h-[140px] overflow-auto p-4">
          {loading ? (
            <div className="flex h-32 items-center justify-center text-xs text-slate-400">
              Merender diagram…
            </div>
          ) : null}
          <div
            ref={containerRef}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
            className="inline-block min-w-full transition-transform duration-150"
          />
        </div>
      )}
    </div>
  );
}
