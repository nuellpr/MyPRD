/**
 * Peta visual PRD: mengubah daftar task datar menjadi alur fase yang mudah dibaca.
 *
 * Fase dihitung dari dependensi antar task (level topologis):
 *   - task tanpa dependensi → Fase 1
 *   - task yang menunggu Fase 1 → Fase 2, dan seterusnya
 *
 * Tidak ada panggilan AI tambahan: semuanya diturunkan dari PRD yang sudah ada,
 * jadi peta selalu sinkron dengan hasil generate terakhir.
 */
import { orderTasks, taskStats, type ParsedTask, type TaskStats } from "./tasks.ts";

export interface RoadmapPhase {
  /** Urutan fase, dimulai dari 0. */
  index: number;
  id: string;
  /** Contoh: "Fase 1". */
  title: string;
  /** Deskripsi singkat peran fase. */
  hint: string;
  tasks: ParsedTask[];
  stats: TaskStats;
}

export interface Roadmap {
  phases: RoadmapPhase[];
  stats: TaskStats;
  /** Rantai dependensi terpanjang (task yang menentukan durasi total). */
  criticalPath: string[];
  /** id task → jumlah task lain yang menunggunya langsung. */
  dependents: Record<string, number>;
  /** Task yang perlu didahulukan: di jalur kritis atau membuka ≥2 task lain. */
  keyTasks: string[];
}

const MIDDLE_HINTS = ["Fitur inti", "Integrasi & alur lanjutan", "Penyempurnaan", "Poles & tambahan"];

export function phaseHint(index: number, total: number): string {
  if (total <= 1) return "Semua task bisa dikerjakan sekaligus";
  if (index === 0) return "Fondasi & setup awal";
  if (index === total - 1) return "Penyelesaian & verifikasi";
  return MIDDLE_HINTS[(index - 1) % MIDDLE_HINTS.length];
}

/** Level topologis tiap task; siklus dependensi diputus supaya tidak menggantung. */
function computeLevels(tasks: ParsedTask[]): Map<string, number> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const levels = new Map<string, number>();

  const visit = (task: ParsedTask, guard: Set<string>): number => {
    const cached = levels.get(task.id);
    if (cached !== undefined) return cached;
    if (guard.has(task.id)) return 0;
    guard.add(task.id);
    let level = 0;
    for (const dep of task.depends) {
      const parent = byId.get(dep);
      if (parent) level = Math.max(level, visit(parent, guard) + 1);
    }
    guard.delete(task.id);
    levels.set(task.id, level);
    return level;
  };

  for (const task of tasks) visit(task, new Set());
  return levels;
}

/** Rantai dependensi terpanjang, diurutkan dari task paling awal. */
function longestChain(tasks: ParsedTask[]): string[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const memo = new Map<string, string[]>();

  const visit = (task: ParsedTask, guard: Set<string>): string[] => {
    const cached = memo.get(task.id);
    if (cached) return cached;
    if (guard.has(task.id)) return [task.id];
    guard.add(task.id);
    let best: string[] = [];
    for (const dep of task.depends) {
      const parent = byId.get(dep);
      if (!parent) continue;
      const chain = visit(parent, guard);
      if (chain.length > best.length) best = chain;
    }
    guard.delete(task.id);
    const result = [...best, task.id];
    memo.set(task.id, result);
    return result;
  };

  let best: string[] = [];
  for (const task of tasks) {
    const chain = visit(task, new Set());
    if (chain.length > best.length) best = chain;
  }
  // Siklus dependensi bisa mengulang id; buang duplikat tapi pertahankan urutan.
  return [...new Set(best)];
}

export function buildRoadmap(tasks: ParsedTask[]): Roadmap {
  const ordered = orderTasks(tasks);
  const levels = computeLevels(ordered);

  const grouped = new Map<number, ParsedTask[]>();
  for (const task of ordered) {
    const level = levels.get(task.id) ?? 0;
    const bucket = grouped.get(level);
    if (bucket) bucket.push(task);
    else grouped.set(level, [task]);
  }

  const levelKeys = [...grouped.keys()].sort((a, b) => a - b);
  const phases: RoadmapPhase[] = levelKeys.map((level, index) => {
    const phaseTasks = grouped.get(level) ?? [];
    return {
      index,
      id: `fase-${index + 1}`,
      title: `Fase ${index + 1}`,
      hint: phaseHint(index, levelKeys.length),
      tasks: phaseTasks,
      stats: taskStats(phaseTasks),
    };
  });

  const dependents: Record<string, number> = {};
  for (const task of ordered) {
    for (const dep of task.depends) {
      if (levels.has(dep)) dependents[dep] = (dependents[dep] ?? 0) + 1;
    }
  }

  const criticalPath = longestChain(ordered);
  const keyTasks = [...new Set([...criticalPath, ...Object.entries(dependents).filter(([, n]) => n >= 2).map(([id]) => id)])];

  return { phases, stats: taskStats(ordered), criticalPath, dependents, keyTasks };
}

/**
 * Ambil daftar fitur dari bagian "Fitur Utama" di PRD (untuk strip ringkasan di peta).
 * Hanya baris daftar yang diambil; teks dirapikan dan dipotong agar tidak memenuhi layar.
 */
export function extractFeatureList(markdown: string, max = 12): string[] {
  const lines = markdown.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,4}\s*.*fitur utama/i.test(lines[i])) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return [];

  const features: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{1,4}\s+/.test(line)) break;
    const match = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.+)$/);
    if (!match) continue;
    let text = match[1].replace(/\*\*/g, "").replace(/`/g, "").trim();
    const cut = text.search(/[—:]| - /);
    if (cut > 3) text = text.slice(0, cut).trim();
    text = text.replace(/[.,;]$/, "").trim();
    if (!text) continue;
    features.push(text.length > 90 ? `${text.slice(0, 87).trimEnd()}...` : text);
    if (features.length >= max) break;
  }
  return features;
}
