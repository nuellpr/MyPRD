"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { buildFeatureTree, type FeatureNode } from "@/lib/roadmap";
import type { ParsedTask, TaskStatus } from "@/lib/tasks";
import { IconCheck } from "../icons";
import { MarkdownView } from "../MarkdownView";

interface RoadmapCanvasProps {
  projectTitle: string;
  prd: string;
  tasks: ParsedTask[];
  saving?: boolean;
  onSavePrd: (nextPrd: string) => Promise<void>;
  onToggleTaskDone: (taskId: string, done: boolean) => Promise<void>;
  onOpenWiki: () => void;
  onOpenFeatureTasks: (featureTitle: string) => void;
}

export function RoadmapCanvas({
  projectTitle,
  prd,
  tasks,
  saving = false,
  onSavePrd,
  onToggleTaskDone,
  onOpenWiki,
  onOpenFeatureTasks,
}: RoadmapCanvasProps) {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [drawerMode, setDrawerMode] = useState<"preview" | "edit">("preview");
  const [drawerText, setDrawerText] = useState(prd);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const dragOriginRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const rootCardRef = useRef<HTMLDivElement>(null);
  const featureCardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [connectors, setConnectors] = useState<{ d: string; id: string }[]>([]);

  const features: FeatureNode[] = useMemo(() => buildFeatureTree(prd, tasks), [prd, tasks]);

  useLayoutEffect(() => {
    function computeConnectors() {
      const container = treeRef.current;
      const rootEl = rootCardRef.current;
      if (!container || !rootEl) {
        setConnectors([]);
        return;
      }

      const rootPos = offsetRelativeTo(rootEl, container);
      const rootLeft = rootPos.left + rootEl.offsetWidth;
      const rootMidY = rootPos.top + rootEl.offsetHeight / 2;

      const paths: { d: string; id: string }[] = [];
      features.forEach((feat, idx) => {
        const card = featureCardRefs.current[idx];
        if (!card) return;
        const cardPos = offsetRelativeTo(card, container);
        const targetX = cardPos.left;
        const targetY = cardPos.top + Math.min(44, card.offsetHeight / 2);
        const midX = (rootLeft + targetX) / 2;
        paths.push({
          id: feat.id,
          d: `M ${rootLeft} ${rootMidY} C ${midX} ${rootMidY}, ${midX} ${targetY}, ${targetX} ${targetY}`,
        });
      });
      setConnectors(paths);
    }

    computeConnectors();
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(computeConnectors) : null;
    if (ro) {
      if (treeRef.current) ro.observe(treeRef.current);
      if (rootCardRef.current) ro.observe(rootCardRef.current);
    }
    window.addEventListener("resize", computeConnectors);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", computeConnectors);
    };
  }, [features, drawerOpen, zoom]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button, a, input, textarea, label, [data-interactive]")) {
      return;
    }
    setDragging(true);
    dragOriginRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || !dragOriginRef.current) return;
    setPan({
      x: dragOriginRef.current.panX + (e.clientX - dragOriginRef.current.x),
      y: dragOriginRef.current.panY + (e.clientY - dragOriginRef.current.y),
    });
  }

  function stopDrag() {
    setDragging(false);
    dragOriginRef.current = null;
  }

  async function saveDrawerPrd() {
    await onSavePrd(drawerText);
    setDrawerMode("preview");
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Collapsible Left Perencanaan Drawer */}
      {drawerOpen ? (
        <aside className="flex w-full shrink-0 flex-col border-r border-slate-800/80 bg-[#080d1b] md:w-[290px] xl:w-[320px]">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#35d6ff]" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Perencanaan
              </h2>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950/70 p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setDrawerMode("preview")}
                  className={`rounded px-2 py-0.5 transition ${
                    drawerMode === "preview" ? "bg-[#35d6ff]/20 text-[#7fe3ff]" : "text-slate-400"
                  }`}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDrawerText(prd);
                    setDrawerMode("edit");
                  }}
                  className={`rounded px-2 py-0.5 font-mono transition ${
                    drawerMode === "edit" ? "bg-[#35d6ff]/20 text-[#7fe3ff]" : "text-slate-400"
                  }`}
                >
                  &lt;/&gt;
                </button>
              </div>
              <button
                type="button"
                onClick={onOpenWiki}
                title="Buka Wiki penuh"
                aria-label="Buka Wiki penuh"
                className="rounded-lg border border-slate-800 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-300 transition hover:border-slate-600 hover:text-white"
              >
                ⤢
              </button>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                title="Tutup panel Perencanaan"
                aria-label="Tutup panel Perencanaan"
                className="rounded-lg border border-slate-800 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-300 transition hover:border-slate-600 hover:text-white"
              >
                «
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
            {drawerMode === "edit" ? (
              <div className="flex h-full flex-col gap-2">
                <textarea
                  value={drawerText}
                  onChange={(e) => setDrawerText(e.target.value)}
                  className="min-h-[380px] flex-1 rounded-xl border border-slate-800 bg-[#070a14] p-3 font-mono text-xs leading-relaxed text-slate-200 focus:border-[#35d6ff] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void saveDrawerPrd()}
                  disabled={saving}
                  className="rounded-lg bg-linear-to-r from-[#4f7cff] to-[#35d6ff] py-2 text-xs font-semibold text-slate-950 disabled:opacity-60"
                >
                  {saving ? "Menyimpan…" : "Simpan PRD"}
                </button>
              </div>
            ) : (
              <MarkdownView content={prd} className="text-xs" />
            )}
          </div>
        </aside>
      ) : null}

      {/* Right Interactive Dot-Grid Mindmap */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrag}
        onPointerLeave={stopDrag}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.08 : -0.08;
            setZoom((z) => Math.min(1.5, Math.max(0.55, Number((z + delta).toFixed(2)))));
          }
        }}
        style={{
          backgroundImage: "radial-gradient(rgba(148, 163, 184, 0.22) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
        className={`relative min-w-0 flex-1 overflow-auto bg-[#060912] ${
          dragging ? "cursor-grabbing select-none" : "cursor-grab"
        }`}
      >
        {/* Top Floating Controls */}
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-3 pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            {!drawerOpen ? (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="rounded-xl border border-slate-700/80 bg-[#0d1326]/95 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-lg transition hover:border-[#35d6ff]/60 hover:text-white"
              >
                Perencanaan »
              </button>
            ) : null}
            <span className="rounded-xl border border-slate-800/90 bg-[#0d1326]/90 px-3 py-1.5 text-[11px] text-slate-300 backdrop-blur">
              {features.length} fitur · {tasks.length} task
            </span>
          </div>

          <div className="inline-flex items-center gap-1 rounded-xl border border-slate-800/90 bg-[#0d1326]/95 p-1 text-xs text-slate-300 shadow-lg pointer-events-auto backdrop-blur">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.55, Number((z - 0.1).toFixed(2))))}
              aria-label="Zoom out roadmap"
              className="rounded-lg px-2.5 py-1 hover:bg-slate-800 hover:text-white"
            >
              −
            </button>
            <span className="min-w-[44px] text-center tabular-nums text-[11px] text-slate-400">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.5, Number((z + 0.1).toFixed(2))))}
              aria-label="Zoom in roadmap"
              className="rounded-lg px-2.5 py-1 hover:bg-slate-800 hover:text-white"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="rounded-lg px-2.5 py-1 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Mindmap Tree Container */}
        <div className="min-w-[540px] p-4 pt-1">
          <div
            ref={treeRef}
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              transformOrigin: "top left",
            }}
            className="relative flex items-start gap-8 transition-transform duration-75"
          >
            {/* Dynamic SVG Curved Connectors */}
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            >
              {connectors.map((c) => (
                <path
                  key={c.id}
                  d={c.d}
                  fill="none"
                  stroke="rgba(53, 214, 255, 0.35)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              ))}
            </svg>

            {/* Project Root Node */}
            <div
              ref={rootCardRef}
              className="relative z-1 mt-12 w-44 shrink-0 rounded-2xl border border-[#35d6ff]/50 bg-[#0d1326]/95 p-3.5 shadow-2xl shadow-[#35d6ff]/10"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#35d6ff]/40 bg-[#35d6ff]/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#7fe3ff]">
                Project Root
              </span>
              <h3 className="mt-2 text-sm font-semibold leading-snug text-white">
                {projectTitle}
              </h3>
              <p className="mt-1.5 text-[11px] text-slate-400">
                {features.length} modul fitur utama · {tasks.filter((t) => t.done).length}/
                {tasks.length} task selesai
              </p>
            </div>

            {/* Feature Cards Column */}
            <div className="relative z-1 grid flex-1 gap-4">
              {features.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-[#0d1326]/90 p-5 text-xs text-slate-400">
                  Belum ada daftar fitur terstruktur. Gunakan <span className="text-slate-200">Workspace Agent</span> untuk menambahkan fitur.
                </div>
              ) : (
                features.map((feat, idx) => {
                  const previewTasks = feat.tasks.slice(0, 3);
                  return (
                    <div
                      key={feat.id}
                      ref={(el) => {
                        featureCardRefs.current[idx] = el;
                      }}
                      className="rounded-2xl border border-slate-800 bg-[#0d1326]/95 p-4 shadow-xl transition hover:border-slate-700"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-md border border-[#4f7cff]/40 bg-[#4f7cff]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                              {feat.phaseLabel}
                            </span>
                            <span className="text-[11px] tabular-nums text-slate-400">
                              {feat.doneCount}/{feat.totalCount} task
                            </span>
                          </div>
                          <h4 className="mt-1.5 text-sm font-semibold text-white">{feat.title}</h4>
                        </div>

                        {feat.totalCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => onOpenFeatureTasks(feat.title)}
                            className="rounded-lg border border-slate-700/80 bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-[#7fe3ff] transition hover:border-[#35d6ff]/60 hover:bg-slate-800"
                          >
                            Lihat semua ({feat.totalCount}) &gt;
                          </button>
                        ) : null}
                      </div>

                      {feat.description ? (
                        <p className="mt-1 text-xs leading-relaxed text-slate-400">
                          {feat.description}
                        </p>
                      ) : null}

                      {/* Sub-fitur pills */}
                      {feat.subFeatures.length > 0 ? (
                        <div className="mt-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            Sub Fitur
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {feat.subFeatures.map((sub) => (
                              <span
                                key={sub}
                                className="rounded-full border border-slate-800 bg-slate-950/75 px-2.5 py-0.5 text-[11px] text-slate-300"
                              >
                                {sub}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {/* Task Checklist Preview */}
                      {previewTasks.length > 0 ? (
                        <div className="mt-3 border-t border-slate-800/80 pt-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            Tasks
                          </p>
                          <div className="mt-1.5 space-y-1.5">
                            {previewTasks.map((task) => {
                              const isDone = task.status === "done" || task.done;
                              return (
                                <label
                                  key={task.id}
                                  data-interactive="true"
                                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-800/70 bg-slate-950/60 px-2.5 py-1.5 text-xs transition hover:border-slate-700"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isDone}
                                    onChange={(e) =>
                                      void onToggleTaskDone(task.id, e.target.checked)
                                    }
                                    className="sr-only"
                                  />
                                  <span
                                    className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                                      isDone
                                        ? "border-emerald-400 bg-emerald-400 text-slate-950"
                                        : "border-slate-600 bg-slate-900"
                                    }`}
                                  >
                                    {isDone ? <IconCheck className="h-3 w-3" /> : null}
                                  </span>
                                  <span className="font-mono text-[11px] text-slate-500">
                                    {task.id}
                                  </span>
                                  <span
                                    className={`flex-1 truncate ${
                                      isDone ? "text-slate-500 line-through" : "text-slate-200"
                                    }`}
                                  >
                                    {task.title}
                                  </span>
                                  <StatusDot status={task.status} />
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function offsetRelativeTo(el: HTMLElement, ancestor: HTMLElement) {
  // Walk offsetParent chain because nested positioned columns reset offsetLeft/offsetTop.
  let left = 0;
  let top = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return { left, top };
}

function StatusDot({ status }: { status: TaskStatus }) {
  const color =
    status === "done"
      ? "bg-emerald-400"
      : status === "in_progress"
        ? "bg-amber-400"
        : status === "failed"
          ? "bg-rose-400"
          : "bg-slate-600";
  return <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} title={status} />;
}
