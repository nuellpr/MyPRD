/**
 * Komunitas: lencana (badge) dan papan peringkat, dihitung dari data yang
 * sudah ada (project, PRD, paket) tanpa tabel baru.
 */
import { getDb } from "./db.ts";
import { getPlan } from "./plans.ts";

export interface Badge {
  id: string;
  name: string;
  description: string;
}

export const BADGES: Badge[] = [
  { id: "perintis", name: "Perintis", description: "Menyusun PRD pertama" },
  { id: "produktif", name: "Produktif", description: "Menyusun 3 PRD" },
  { id: "maraton", name: "Maraton", description: "Menyusun 10 PRD" },
  { id: "pendukung", name: "Pendukung", description: "Berlangganan paket berbayar" },
];

export interface UserStats {
  prdCount: number;
  projectCount: number;
  plan: string;
}

export function badgesForStats(stats: UserStats): Badge[] {
  const earned: Badge[] = [];
  if (stats.prdCount >= 1) earned.push(BADGES[0]);
  if (stats.prdCount >= 3) earned.push(BADGES[1]);
  if (stats.prdCount >= 10) earned.push(BADGES[2]);
  if (getPlan(stats.plan).id !== "free") earned.push(BADGES[3]);
  return earned;
}

export function getUserStats(userId: string): UserStats {
  const db = getDb();
  const prd = db
    .prepare("SELECT COUNT(*) AS c FROM prds d JOIN projects p ON p.id = d.project_id WHERE p.user_id = ?")
    .get(userId) as { c: number };
  const proj = db.prepare("SELECT COUNT(*) AS c FROM projects WHERE user_id = ?").get(userId) as {
    c: number;
  };
  const user = db.prepare("SELECT plan FROM users WHERE id = ?").get(userId) as
    | { plan: string }
    | undefined;
  return { prdCount: Number(prd.c), projectCount: Number(proj.c), plan: user?.plan ?? "free" };
}

export interface LeaderboardEntry {
  name: string;
  prdCount: number;
  projectCount: number;
  badges: Badge[];
}

export function getLeaderboard(limit = 20): LeaderboardEntry[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT u.name AS name, u.plan AS plan,
              COUNT(DISTINCT p.id) AS projects,
              COUNT(DISTINCT d.project_id) AS prds
         FROM users u
         LEFT JOIN projects p ON p.user_id = u.id
         LEFT JOIN prds d ON d.project_id = p.id
        GROUP BY u.id
       HAVING prds > 0
        ORDER BY prds DESC, projects DESC
        LIMIT ?`,
    )
    .all(limit) as { name: string; plan: string; projects: number; prds: number }[];
  return rows.map((row) => {
    const stats: UserStats = { prdCount: Number(row.prds), projectCount: Number(row.projects), plan: row.plan };
    return { name: row.name, prdCount: stats.prdCount, projectCount: stats.projectCount, badges: badgesForStats(stats) };
  });
}
