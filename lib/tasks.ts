/**
 * Parsing bagian "Task Breakdown" dari PRD menjadi data terstruktur.
 *
 * Format yang diharapkan (dihasilkan system prompt di lib/prd.ts):
 *   - [ ] T1 — <judul> | fitur: <Nama Fitur> | prioritas: utama/penting/tambahan | file: <path> | depends: <T0/none> | kompleksitas: S/M/L
 *
 * Parser dibuat toleran: kalau format tidak persis, baris tetap diambil
 * sebagai task dengan metadata seadanya supaya user tidak kehilangan data.
 */
export type TaskStatus = "todo" | "in_progress" | "done" | "failed";
export type TaskPriority = "utama" | "penting" | "tambahan";

export interface ParsedTask {
  id: string;
  title: string;
  files: string[];
  depends: string[];
  complexity: "S" | "M" | "L" | "?";
  done: boolean;
  status: TaskStatus;
  feature?: string;
  priority: TaskPriority;
  hasExplicitPriority?: boolean;
}

const TASK_LINE = /^\s*[-*]\s*\[( |x|X)\]\s*(.+)$/;

function splitMeta(rest: string): { title: string; meta: Map<string, string> } {
  const parts = rest.split("|").map((p) => p.trim());
  const title = parts.shift() ?? rest;
  const meta = new Map<string, string>();
  for (const part of parts) {
    const idx = part.indexOf(":");
    if (idx > 0) meta.set(part.slice(0, idx).trim().toLowerCase(), part.slice(idx + 1).trim());
  }
  return { title, meta };
}

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v !== "" && !/^(none|-|n\/a)$/i.test(v));
}

function normalizePriority(raw: string | undefined, complexity: ParsedTask["complexity"]): { priority: TaskPriority; explicit: boolean } {
  const lower = (raw ?? "").trim().toLowerCase();
  if (lower === "utama" || lower === "high" || lower === "tinggi") return { priority: "utama", explicit: true };
  if (lower === "penting" || lower === "medium" || lower === "sedang") return { priority: "penting", explicit: true };
  if (lower === "tambahan" || lower === "low" || lower === "rendah") return { priority: "tambahan", explicit: true };
  if (complexity === "L") return { priority: "utama", explicit: false };
  if (complexity === "M") return { priority: "penting", explicit: false };
  return { priority: "tambahan", explicit: false };
}

function parseTaskLine(line: string, fallbackIndex: number): ParsedTask | null {
  const match = line.match(TASK_LINE);
  if (!match) return null;
  const done = match[1].toLowerCase() === "x";
  const { title, meta } = splitMeta(match[2]);
  const idMatch = title.match(/^(T\d+)\b\s*[—\-–:.]?\s*/i);
  const id = idMatch ? idMatch[1].toUpperCase() : `T${fallbackIndex}`;
  const cleanTitle = idMatch ? title.slice(idMatch[0].length).trim() : title;
  const complexityRaw = (meta.get("kompleksitas") ?? meta.get("complexity") ?? "?").toUpperCase();
  const complexity = complexityRaw === "S" || complexityRaw === "M" || complexityRaw === "L" ? complexityRaw : "?";

  const statusRaw = (meta.get("status") ?? "").trim().toLowerCase();
  const status: TaskStatus = done
    ? "done"
    : statusRaw === "in_progress" || statusRaw === "dikerjakan"
      ? "in_progress"
      : statusRaw === "failed" || statusRaw === "gagal"
        ? "failed"
        : "todo";

  const featureRaw = (meta.get("fitur") ?? meta.get("feature") ?? "").trim();
  const { priority, explicit } = normalizePriority(meta.get("prioritas") ?? meta.get("priority"), complexity);

  return {
    id,
    title: cleanTitle || title,
    files: parseList(meta.get("file") ?? meta.get("files")),
    depends: parseList(meta.get("depends") ?? meta.get("depends_on")),
    complexity,
    done,
    status,
    ...(featureRaw ? { feature: featureRaw } : {}),
    priority,
    hasExplicitPriority: explicit,
  };
}

/** Ambil bagian Task Breakdown dari markdown PRD. */
export function extractTaskSection(markdown: string): string | null {
  const lines = markdown.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,4}\s*.*task breakdown/i.test(lines[i])) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return null;
  const collected: string[] = [];
  for (let i = start; i < lines.length; i++) {
    if (/^#{1,4}\s+/.test(lines[i])) break;
    collected.push(lines[i]);
  }
  return collected.join("\n");
}

export function parseTasks(markdown: string): ParsedTask[] {
  const section = extractTaskSection(markdown);
  if (!section) return [];
  const tasks: ParsedTask[] = [];
  for (const line of section.split(/\r?\n/)) {
    const parsed = parseTaskLine(line, tasks.length + 1);
    if (parsed) tasks.push(parsed);
  }
  return tasks;
}

/** Format satu task ke baris markdown checklist. */
export function formatTaskLine(t: ParsedTask): string {
  const meta: string[] = [];
  if (t.feature) meta.push(`fitur: ${t.feature}`);
  if (t.hasExplicitPriority) meta.push(`prioritas: ${t.priority}`);
  if (t.files.length) meta.push(`file: ${t.files.join(", ")}`);
  if (t.depends.length) meta.push(`depends: ${t.depends.join(", ")}`);
  if (t.complexity !== "?") meta.push(`kompleksitas: ${t.complexity}`);
  if (!t.done && (t.status === "in_progress" || t.status === "failed")) {
    meta.push(`status: ${t.status}`);
  }
  const suffix = meta.length ? ` | ${meta.join(" | ")}` : "";
  return `- [${t.done ? "x" : " "}] ${t.id} — ${t.title}${suffix}`;
}

/** Perbarui status sejumlah task di dalam markdown PRD (hanya di bagian Task Breakdown). */
export function updateTaskStatusesInPrd(markdown: string, taskIds: string[], nextStatus: TaskStatus): string {
  const targetIds = new Set(taskIds.map((id) => id.toUpperCase()));
  if (targetIds.size === 0) return markdown;

  const lines = markdown.split(/\r?\n/);
  let inTaskSection = false;
  let count = 0;

  const updated = lines.map((line) => {
    if (/^#{1,4}\s+/.test(line)) {
      inTaskSection = /^#{1,4}\s*.*task breakdown/i.test(line);
      return line;
    }
    if (!inTaskSection) return line;
    const parsed = parseTaskLine(line, count + 1);
    if (!parsed) return line;
    count += 1;
    if (!targetIds.has(parsed.id.toUpperCase())) return line;
    const nextTask: ParsedTask = {
      ...parsed,
      done: nextStatus === "done",
      status: nextStatus,
    };
    return formatTaskLine(nextTask);
  });

  return updated.join("\n");
}

/** Urutkan task secara topologis berdasarkan `depends` (fallback: urutan asli). */
export function orderTasks(tasks: ParsedTask[]): ParsedTask[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const result: ParsedTask[] = [];

  const visit = (task: ParsedTask, guard: Set<string>) => {
    if (visited.has(task.id) || guard.has(task.id)) return;
    guard.add(task.id);
    for (const dep of task.depends) {
      const parent = byId.get(dep);
      if (parent) visit(parent, guard);
    }
    guard.delete(task.id);
    if (!visited.has(task.id)) {
      visited.add(task.id);
      result.push(task);
    }
  };

  for (const task of tasks) visit(task, new Set());
  return result;
}

export interface TaskStats {
  total: number;
  done: number;
  byComplexity: Record<"S" | "M" | "L" | "?", number>;
  files: number;
}

export function taskStats(tasks: ParsedTask[]): TaskStats {
  const byComplexity: TaskStats["byComplexity"] = { S: 0, M: 0, L: 0, "?": 0 };
  const files = new Set<string>();
  let done = 0;
  for (const task of tasks) {
    byComplexity[task.complexity] += 1;
    if (task.done) done += 1;
    for (const f of task.files) files.add(f);
  }
  return { total: tasks.length, done, byComplexity, files: files.size };
}

/** Export task ke JSON yang siap dipakai tooling/agent. */
export function tasksToJson(projectTitle: string, tasks: ParsedTask[]): string {
  return JSON.stringify(
    {
      project: projectTitle,
      generatedAt: new Date().toISOString(),
      tasks: orderTasks(tasks).map((t) => ({
        id: t.id,
        title: t.title,
        ...(t.feature ? { feature: t.feature } : {}),
        priority: t.priority,
        status: t.status,
        files: t.files,
        depends: t.depends,
        complexity: t.complexity,
        done: t.done,
      })),
    },
    null,
    2,
  );
}

/** Export task ke checklist markdown. */
export function tasksToMarkdown(projectTitle: string, tasks: ParsedTask[]): string {
  const ordered = orderTasks(tasks);
  const stats = taskStats(ordered);
  return [
    `# Task Breakdown — ${projectTitle}`,
    "",
    `Total: ${stats.total} task · Selesai: ${stats.done} · Kompleksitas S/M/L: ${stats.byComplexity.S}/${stats.byComplexity.M}/${stats.byComplexity.L}`,
    "",
    ...ordered.map((t) => formatTaskLine(t)),
    "",
  ].join("\n");
}
