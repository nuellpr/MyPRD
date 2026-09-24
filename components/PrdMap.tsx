"use client";

import { useMemo } from "react";
import { buildRoadmap, type RoadmapPhase } from "@/lib/roadmap";
import type { ParsedTask } from "@/lib/tasks";

interface Props {
  tasks: ParsedTask[];
  features: string[];
  projectTitle: string;
}

const COMPLEXITY_STYLE: Record<ParsedTask["complexity"], { label: string; title: string; className: string }> = {
  S: { label: "S", title: "Kompleksitas kecil", className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" },
  M: { label: "M", title: "Kompleksitas sedang", className: "border-amber-500/40 bg-amber-500/15 text-amber-200" },
  L: { label: "L", title: "Kompleksitas besar", className: "border-rose-500/40 bg-rose-500/15 text-rose-300" },
  "?": { label: "?", title: "Kompleksitas belum dinilai", className: "border-slate-700 bg-slate-800/60 text-slate-400" },
};

function TaskCard({ task, isKey, onCriticalPath }: { task: ParsedTask; isKey: boolean; onCriticalPath: boolean }) {
  const complexity = COMPLEXITY_STYLE[task.complexity];
  return (
    <div
      className={`w-full rounded-xl border bg-slate-950/80 p-3 sm:w-64 ${
        onCriticalPath ? "border-sky-500/50" : "border-slate-800"
      } ${task.done ? "opacity-70" : ""}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-sky-300">{task.id}</span>
        <span
          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${complexity.className}`}
          title={complexity.title}
        >
          {complexity.label}
        </span>
        {isKey ? (
          <span
            className="rounded border border-sky-500/40 bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-300"
            title="Bagian dari jalur kritis atau membuka task lain"
          >
            Kunci
          </span>
        ) : null}
        {task.done ? <span className="ml-auto text-[11px] text-emerald-400">selesai</span> : null}
      </div>
      <p className={`mt-2 text-sm leading-snug ${task.done ? "text-slate-500 line-through" : "text-slate-200"}`}>
        {task.title}
      </p>
      {task.files.length ? (
        <p className="mt-2 truncate font-mono text-[11px] text-slate-500" title={task.files.join(", ")}>
          {task.files.join(", ")}
        </p>
      ) : null}
      {task.depends.length ? <p className="mt-1.5 text-[11px] text-slate-500">menunggu {task.depends.join(", ")}</p> : null}
    </div>
  );
}

function PhaseSection({
  phase,
  isLast,
  criticalPath,
  keyTasks,
}: {
  phase: RoadmapPhase;
  isLast: boolean;
  criticalPath: string[];
  keyTasks: string[];
}) {
  const allDone = phase.stats.total > 0 && phase.stats.done === phase.stats.total;
  return (
    <div className="flex gap-3">
      {/* Rail vertikal penghubung antar fase */}
      <div className="flex w-5 shrink-0 flex-col items-center">
        <span
          className={`mt-2 h-3 w-3 shrink-0 rounded-full border-2 ${
            allDone ? "border-emerald-400 bg-emerald-400" : "border-sky-500 bg-slate-950"
          }`}
        />
        {!isLast ? <span className="w-px flex-1 bg-slate-800" /> : null}
      </div>

      <div className="min-w-0 flex-1 pb-6">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h3 className="text-sm font-semibold text-slate-100">{phase.title}</h3>
          <span className="text-[11px] text-slate-500">{phase.hint}</span>
          <span className="ml-auto text-[11px] tabular-nums text-slate-500">
            {phase.stats.done}/{phase.stats.total} selesai
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {phase.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isKey={keyTasks.includes(task.id)}
              onCriticalPath={criticalPath.includes(task.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PrdMap({ tasks, features, projectTitle }: Props) {
  const roadmap = useMemo(() => buildRoadmap(tasks), [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="grid h-full place-items-center text-center">
        <div className="max-w-sm text-sm text-slate-400">
          <p className="font-medium text-slate-300">Peta belum bisa dibuat</p>
          <p className="mt-1">
            Peta dibangun dari bagian <span className="text-slate-200">Task Breakdown</span> di PRD. Generate PRD dulu, atau
            tambahkan daftar task manual di tab Editor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <span className="font-medium text-slate-200">{projectTitle}</span>
        <span>
          {roadmap.stats.total} task · {roadmap.stats.done} selesai · {roadmap.phases.length} fase · {roadmap.stats.files} file
        </span>
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> S
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" /> M
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-400" /> L
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-sky-400" /> Kunci
          </span>
        </span>
      </div>

      {features.length ? (
        <div className="flex flex-wrap gap-1.5">
          {features.map((feature) => (
            <span
              key={feature}
              className="rounded-full border border-slate-800 bg-slate-900/70 px-2.5 py-1 text-[11px] text-slate-300"
            >
              {feature}
            </span>
          ))}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
        {roadmap.phases.map((phase, index) => (
          <PhaseSection
            key={phase.id}
            phase={phase}
            isLast={index === roadmap.phases.length - 1}
            criticalPath={roadmap.criticalPath}
            keyTasks={roadmap.keyTasks}
          />
        ))}
      </div>

      {roadmap.criticalPath.length > 1 ? (
        <p className="text-[11px] text-slate-500">
          Jalur kritis: <span className="font-mono text-sky-300">{roadmap.criticalPath.join(" → ")}</span> — kerjakan berurutan
          supaya tidak menghambat fase berikutnya.
        </p>
      ) : null}
    </div>
  );
}
