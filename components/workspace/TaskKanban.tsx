"use client";

import { useMemo, useState } from "react";
import { orderTasks, type ParsedTask, type TaskPriority, type TaskStatus } from "@/lib/tasks";
import { IconCheck } from "../icons";

const COLUMNS: { status: TaskStatus; label: string; dot: string; ring: string }[] = [
  {
    status: "todo",
    label: "Belum mulai",
    dot: "bg-slate-400",
    ring: "border-slate-800 bg-slate-950/60",
  },
  {
    status: "in_progress",
    label: "Dikerjakan",
    dot: "bg-amber-400",
    ring: "border-amber-500/30 bg-amber-500/5",
  },
  {
    status: "done",
    label: "Selesai",
    dot: "bg-emerald-400",
    ring: "border-emerald-500/30 bg-emerald-500/5",
  },
  {
    status: "failed",
    label: "Gagal",
    dot: "bg-rose-400",
    ring: "border-rose-500/30 bg-rose-500/5",
  },
];

function priorityBadge(priority: TaskPriority) {
  if (priority === "utama") {
    return "border-rose-500/40 bg-rose-500/15 text-rose-200";
  }
  if (priority === "penting") {
    return "border-amber-500/40 bg-amber-500/15 text-amber-200";
  }
  return "border-slate-700 bg-slate-900 text-slate-300";
}

function priorityLabel(priority: TaskPriority): string {
  if (priority === "utama") return "Utama";
  if (priority === "penting") return "Penting";
  return "Tambahan";
}

interface TaskKanbanProps {
  tasks: ParsedTask[];
  featureFilter: string;
  onFeatureFilterChange: (feature: string) => void;
  onUpdateStatuses: (taskIds: string[], nextStatus: TaskStatus) => Promise<void>;
}

export function TaskKanban({
  tasks,
  featureFilter,
  onFeatureFilterChange,
  onUpdateStatuses,
}: TaskKanbanProps) {
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const ordered = useMemo(() => orderTasks(tasks), [tasks]);

  const featureOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const t of tasks) {
      if (t.feature) seen.add(t.feature);
    }
    return [...seen];
  }, [tasks]);

  const filtered = useMemo(() => {
    if (!featureFilter || featureFilter === "ALL") return ordered;
    return ordered.filter(
      (t) =>
        (t.feature ?? "").toLowerCase().includes(featureFilter.toLowerCase()) ||
        featureFilter.toLowerCase().includes((t.feature ?? "").toLowerCase()),
    );
  }, [ordered, featureFilter]);

  const doneCount = tasks.filter((t) => t.status === "done" || t.done).length;
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((t) => selectedIds.includes(t.id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((t) => t.id));
    }
  }

  async function applyBulk(nextStatus: TaskStatus) {
    if (selectedIds.length === 0) return;
    await onUpdateStatuses(selectedIds, nextStatus);
    setSelectedIds([]);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#070a14]">
      {/* Toolbar & Progress Bar */}
      <div className="border-b border-slate-800/80 bg-[#0a0f1f]/90 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5 sm:max-w-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Progres Task</span>
              <span className="tabular-nums text-slate-400">
                {doneCount}/{tasks.length} selesai ({pct}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900">
              <div
                className="h-full rounded-full bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-emerald-400 transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Feature filter */}
            <select
              aria-label="Filter fitur"
              value={featureFilter}
              onChange={(e) => onFeatureFilterChange(e.target.value)}
              className="rounded-lg border border-slate-700/80 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:border-[#35d6ff] focus:outline-none"
            >
              <option value="ALL">Semua fitur ({tasks.length})</option>
              {featureOptions.map((feat) => (
                <option key={feat} value={feat}>
                  {feat}
                </option>
              ))}
            </select>

            {/* Select all */}
            <button
              type="button"
              onClick={toggleSelectAll}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                allFilteredSelected
                  ? "border-[#35d6ff]/70 bg-[#35d6ff]/15 text-[#7fe3ff]"
                  : "border-slate-700/80 bg-slate-900 text-slate-300 hover:border-slate-500"
              }`}
            >
              {allFilteredSelected ? "Batal pilih" : "Pilih semua"}
            </button>

            {/* Board / List Switcher */}
            <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("board")}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  viewMode === "board"
                    ? "bg-[#35d6ff]/20 text-[#7fe3ff]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Board
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`rounded-md px-2.5 py-1 font-medium transition ${
                  viewMode === "list"
                    ? "bg-[#35d6ff]/20 text-[#7fe3ff]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                List
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Status Updater */}
        {selectedIds.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#35d6ff]/40 bg-[#35d6ff]/10 px-3 py-2 text-xs">
            <span className="font-medium text-[#7fe3ff]">{selectedIds.length} task dipilih</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-slate-300">Ubah status ke:</span>
              {COLUMNS.map((col) => (
                <button
                  key={col.status}
                  type="button"
                  onClick={() => void applyBulk(col.status)}
                  className="rounded-lg border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-[11px] font-medium text-slate-200 transition hover:border-[#35d6ff] hover:text-white"
                >
                  {col.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
        {tasks.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-slate-800 bg-[#0d1326] p-6 text-center text-sm text-slate-400">
            Belum ada task terdeteksi di PRD. Gunakan <strong className="text-slate-200">Workspace Agent</strong> untuk menambahkan task breakdown.
          </div>
        ) : viewMode === "board" ? (
          <div className="grid min-w-[920px] grid-cols-4 gap-4">
            {COLUMNS.map((col) => {
              const colTasks = filtered.filter((t) => t.status === col.status);
              return (
                <div
                  key={col.status}
                  data-kanban-column={col.status}
                  className={`flex min-h-[380px] flex-col rounded-2xl border p-3 ${col.ring}`}
                >
                  <div className="mb-3 flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                      <h3 className="text-xs font-semibold text-slate-100">{col.label}</h3>
                    </div>
                    <span className="rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5 text-[11px] tabular-nums text-slate-400">
                      {colTasks.length}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {colTasks.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-800/80 p-4 text-center text-[11px] text-slate-500">
                        Kosong
                      </p>
                    ) : (
                      colTasks.map((task) => {
                        const checked = selectedIds.includes(task.id);
                        return (
                          <div
                            key={task.id}
                            data-task-id={task.id}
                            className="rounded-xl border border-slate-800/90 bg-[#0d1326] p-3 shadow-md transition hover:border-slate-700"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <label className="inline-flex cursor-pointer items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleSelect(task.id)}
                                  className="sr-only"
                                />
                                <span
                                  className={`grid h-4 w-4 place-items-center rounded border ${
                                    checked
                                      ? "border-[#35d6ff] bg-[#35d6ff] text-slate-950"
                                      : "border-slate-600 bg-slate-900"
                                  }`}
                                >
                                  {checked ? <IconCheck className="h-3 w-3" /> : null}
                                </span>
                                <span className="font-mono text-[11px] font-semibold text-[#7fe3ff]">
                                  {task.id}
                                </span>
                              </label>

                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${priorityBadge(
                                  task.priority,
                                )}`}
                              >
                                {priorityLabel(task.priority)}
                              </span>
                            </div>

                            <p className="mt-2 text-xs font-medium leading-snug text-slate-100">
                              {task.title}
                            </p>

                            <div className="mt-2 flex flex-wrap gap-1">
                              {task.feature ? (
                                <span className="rounded-md border border-slate-800 bg-slate-950/80 px-1.5 py-0.5 text-[10px] text-slate-300">
                                  {task.feature}
                                </span>
                              ) : null}
                              {task.complexity !== "?" ? (
                                <span className="rounded-md border border-slate-800 bg-slate-950/80 px-1.5 py-0.5 text-[10px] text-slate-400">
                                  {task.complexity}
                                </span>
                              ) : null}
                            </div>

                            {task.files.length > 0 ? (
                              <p className="mt-2 truncate font-mono text-[10px] text-slate-500">
                                {task.files.join(", ")}
                              </p>
                            ) : null}

                            <div className="mt-2.5 border-t border-slate-800/80 pt-2">
                              <select
                                aria-label={`Status ${task.id}`}
                                value={task.status}
                                onChange={(e) =>
                                  void onUpdateStatuses([task.id], e.target.value as TaskStatus)
                                }
                                className="w-full rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-1 text-[11px] text-slate-200 focus:border-[#35d6ff] focus:outline-none"
                              >
                                {COLUMNS.map((c) => (
                                  <option key={c.status} value={c.status}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-2">
            {filtered.map((task) => {
              const checked = selectedIds.includes(task.id);
              return (
                <div
                  key={task.id}
                  data-task-id={task.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#0d1326] px-4 py-3"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <label className="cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(task.id)}
                        className="sr-only"
                      />
                      <span
                        className={`grid h-4 w-4 place-items-center rounded border ${
                          checked
                            ? "border-[#35d6ff] bg-[#35d6ff] text-slate-950"
                            : "border-slate-600 bg-slate-900"
                        }`}
                      >
                        {checked ? <IconCheck className="h-3 w-3" /> : null}
                      </span>
                    </label>
                    <span className="font-mono text-xs font-semibold text-[#7fe3ff]">
                      {task.id}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-100">{task.title}</p>
                      <p className="truncate font-mono text-[11px] text-slate-500">
                        {[task.feature, ...task.files].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${priorityBadge(
                        task.priority,
                      )}`}
                    >
                      {priorityLabel(task.priority)}
                    </span>
                    <select
                      aria-label={`Status ${task.id}`}
                      value={task.status}
                      onChange={(e) =>
                        void onUpdateStatuses([task.id], e.target.value as TaskStatus)
                      }
                      className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-xs text-slate-200 focus:border-[#35d6ff] focus:outline-none"
                    >
                      {COLUMNS.map((c) => (
                        <option key={c.status} value={c.status}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
