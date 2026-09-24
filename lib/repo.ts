/**
 * Repository: semua akses data project, pesan chat, PRD, dan usage.
 *
 * Isi pesan & PRD disimpan terenkripsi (AES-256-GCM) di kolom `*_enc`,
 * lalu didekripsi saat dibaca supaya tidak tersebar logika crypto di route.
 */
import { getDb, startOfMonthMs, type MessageRow, type OrderRow, type PrdRow, type ProjectRow } from "./db.ts";
import { decryptContent, encryptContent, newId } from "./crypto.ts";
import { evaluateQuota, getPlan, type QuotaState } from "./plans.ts";

export interface Project {
  id: string;
  userId: string;
  title: string;
  idea: string;
  modelId: string;
  language: string;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessageRecord {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

export interface PrdRecord {
  id: string;
  projectId: string;
  content: string;
  version: number;
  createdAt: number;
  updatedAt: number;
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    idea: row.idea,
    modelId: row.model_id,
    language: row.language,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createProject(input: {
  userId: string;
  title: string;
  idea: string;
  modelId: string;
  language: string;
}): Project {
  const now = Date.now();
  const row: ProjectRow = {
    id: newId("prj"),
    user_id: input.userId,
    title: input.title.trim().slice(0, 120) || "Project baru",
    idea: input.idea.trim(),
    model_id: input.modelId,
    language: input.language,
    status: "chatting",
    created_at: now,
    updated_at: now,
  };
  getDb()
    .prepare(
      "INSERT INTO projects (id, user_id, title, idea, model_id, language, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(row.id, row.user_id, row.title, row.idea, row.model_id, row.language, row.status, row.created_at, row.updated_at);
  return toProject(row);
}

export function listProjects(userId: string): Project[] {
  const rows = getDb()
    .prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC")
    .all(userId) as unknown as ProjectRow[];
  return rows.map(toProject);
}

export function getProject(userId: string, projectId: string): Project | null {
  const row = getDb().prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, userId) as
    | ProjectRow
    | undefined;
  return row ? toProject(row) : null;
}

export function updateProject(
  userId: string,
  projectId: string,
  patch: Partial<Pick<Project, "title" | "idea" | "modelId" | "language" | "status">>,
): Project | null {
  const existing = getProject(userId, projectId);
  if (!existing) return null;
  const next = { ...existing, ...patch, updatedAt: Date.now() };
  getDb()
    .prepare("UPDATE projects SET title = ?, idea = ?, model_id = ?, language = ?, status = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .run(next.title, next.idea, next.modelId, next.language, next.status, next.updatedAt, projectId, userId);
  return next;
}

export function touchProject(projectId: string): void {
  getDb().prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(Date.now(), projectId);
}

export function deleteProject(userId: string, projectId: string): boolean {
  const result = getDb().prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").run(projectId, userId);
  return Number(result.changes) > 0;
}

export function addMessage(projectId: string, role: "user" | "assistant", content: string): ChatMessageRecord {
  const record: ChatMessageRecord = { id: newId("msg"), role, content, createdAt: Date.now() };
  getDb()
    .prepare("INSERT INTO messages (id, project_id, role, content_enc, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(record.id, projectId, role, encryptContent(content), record.createdAt);
  return record;
}

export function listMessages(projectId: string): ChatMessageRecord[] {
  const rows = getDb()
    .prepare("SELECT * FROM messages WHERE project_id = ? ORDER BY created_at ASC")
    .all(projectId) as unknown as MessageRow[];
  return rows.map((row) => ({
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    content: decryptContent(row.content_enc),
    createdAt: row.created_at,
  }));
}

export function getPrd(projectId: string): PrdRecord | null {
  const row = getDb().prepare("SELECT * FROM prds WHERE project_id = ?").get(projectId) as PrdRow | undefined;
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    content: decryptContent(row.content_enc),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Simpan/overwrite PRD project, versi naik tiap kali disimpan ulang. */
export function savePrd(projectId: string, content: string): PrdRecord {
  const existing = getPrd(projectId);
  const now = Date.now();
  const encrypted = encryptContent(content);
  if (existing) {
    getDb()
      .prepare("UPDATE prds SET content_enc = ?, version = ?, updated_at = ? WHERE project_id = ?")
      .run(encrypted, existing.version + 1, now, projectId);
    return { ...existing, content, version: existing.version + 1, updatedAt: now };
  }
  const record: PrdRecord = {
    id: newId("prd"),
    projectId,
    content,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  getDb()
    .prepare("INSERT INTO prds (id, project_id, content_enc, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(record.id, projectId, encrypted, record.version, record.createdAt, record.updatedAt);
  return record;
}

export interface RecordUsageInput {
  userId: string;
  projectId?: string | null;
  kind: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export function recordUsage(input: RecordUsageInput): void {
  getDb()
    .prepare(
      "INSERT INTO usage_events (id, user_id, project_id, kind, provider, model, tokens_in, tokens_out, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      newId("usg"),
      input.userId,
      input.projectId ?? null,
      input.kind,
      input.provider,
      input.model,
      Math.round(input.tokensIn),
      Math.round(input.tokensOut),
      input.costUsd,
      Date.now(),
    );
}

/** Kuota dihitung dari usage_events bulan berjalan (kind = 'prd' / 'task'). */
export function getQuotaState(userId: string, plan: string): QuotaState {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS c FROM usage_events WHERE user_id = ? AND kind = 'prd' AND created_at >= ?")
    .get(userId, startOfMonthMs()) as { c: number } | undefined;
  return evaluateQuota(plan, Number(row?.c ?? 0));
}

export interface UsageSummary {
  totalCostUsd: number;
  totalTokensIn: number;
  totalTokensOut: number;
  events: number;
  byModel: { model: string; provider: string; costUsd: number; tokensOut: number; events: number }[];
}

export function getUsageSummary(userId: string, sinceMs = 0): UsageSummary {
  const db = getDb();
  const totals = db
    .prepare(
      "SELECT COUNT(*) AS events, COALESCE(SUM(cost_usd),0) AS cost, COALESCE(SUM(tokens_in),0) AS tin, COALESCE(SUM(tokens_out),0) AS tout FROM usage_events WHERE user_id = ? AND created_at >= ?",
    )
    .get(userId, sinceMs) as { events: number; cost: number; tin: number; tout: number };
  const byModel = db
    .prepare(
      "SELECT model, provider, COUNT(*) AS events, COALESCE(SUM(cost_usd),0) AS costUsd, COALESCE(SUM(tokens_out),0) AS tokensOut FROM usage_events WHERE user_id = ? AND created_at >= ? GROUP BY model, provider ORDER BY costUsd DESC LIMIT 10",
    )
    .all(userId, sinceMs) as unknown as { model: string; provider: string; events: number; costUsd: number; tokensOut: number }[];
  return {
    totalCostUsd: Number(totals.cost),
    totalTokensIn: Number(totals.tin),
    totalTokensOut: Number(totals.tout),
    events: Number(totals.events),
    byModel: byModel.map((r) => ({
      model: r.model,
      provider: r.provider,
      costUsd: Number(r.costUsd),
      tokensOut: Number(r.tokensOut),
      events: Number(r.events),
    })),
  };
}

export interface Order {
  id: string;
  userId: string;
  plan: string;
  amountIdr: number;
  status: string;
  provider: string;
  providerRef: string;
  createdAt: number;
  updatedAt: number;
}

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    userId: row.user_id,
    plan: row.plan,
    amountIdr: Number(row.amount_idr),
    status: row.status,
    provider: row.provider,
    providerRef: row.provider_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createOrder(input: { userId: string; plan: string; amountIdr: number; provider: string }): Order {
  const now = Date.now();
  const row: OrderRow = {
    id: newId("ord"),
    user_id: input.userId,
    plan: input.plan,
    amount_idr: input.amountIdr,
    status: "pending",
    provider: input.provider,
    provider_ref: "",
    created_at: now,
    updated_at: now,
  };
  getDb()
    .prepare(
      "INSERT INTO orders (id, user_id, plan, amount_idr, status, provider, provider_ref, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(row.id, row.user_id, row.plan, row.amount_idr, row.status, row.provider, row.provider_ref, row.created_at, row.updated_at);
  return toOrder(row);
}

/** Ambil order milik user (untuk UI). */
export function getOrder(userId: string, orderId: string): Order | null {
  const row = getDb().prepare("SELECT * FROM orders WHERE id = ? AND user_id = ?").get(orderId, userId) as
    | OrderRow
    | undefined;
  return row ? toOrder(row) : null;
}

/** Ambil order tanpa scope user — hanya untuk webhook provider. */
export function getOrderById(orderId: string): Order | null {
  const row = getDb().prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow | undefined;
  return row ? toOrder(row) : null;
}

export function listOrders(userId: string): Order[] {
  const rows = getDb().prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC").all(userId) as unknown as OrderRow[];
  return rows.map(toOrder);
}

export function setOrderProviderRef(orderId: string, ref: string): void {
  getDb().prepare("UPDATE orders SET provider_ref = ?, updated_at = ? WHERE id = ?").run(ref, Date.now(), orderId);
}

/**
 * Tandai order lunas + upgrade paket user. Idempoten: kalau order sudah `paid`,
 * tidak ada perubahan dan `alreadyPaid` true (notifikasi ganda aman).
 */
export function markOrderPaid(orderId: string): { order: Order; alreadyPaid: boolean } | null {
  const order = getOrderById(orderId);
  if (!order) return null;
  if (order.status === "paid") return { order, alreadyPaid: true };
  const plan = getPlan(order.plan);
  getDb().prepare("UPDATE orders SET status = 'paid', updated_at = ? WHERE id = ?").run(Date.now(), orderId);
  getDb().prepare("UPDATE users SET plan = ? WHERE id = ?").run(plan.id, order.userId);
  const updated = getOrderById(orderId);
  if (!updated) return null;
  return { order: updated, alreadyPaid: false };
}

/**
 * Ubah status order non-paid (gagal/kedaluwarsa). Order yang sudah `paid`
 * tidak pernah diturunkan — proteksi dari notifikasi susulan.
 */
export function setOrderStatus(orderId: string, status: "failed" | "expired"): Order | null {
  const order = getOrderById(orderId);
  if (!order || order.status !== "pending") return order;
  getDb().prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(status, Date.now(), orderId);
  return getOrderById(orderId);
}

export function updateUserPlan(userId: string, plan: string): void {
  getDb().prepare("UPDATE users SET plan = ? WHERE id = ?").run(getPlan(plan).id, userId);
}
