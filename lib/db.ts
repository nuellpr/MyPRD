/**
 * Layer database (SQLite via `node:sqlite`).
 *
 * Alasan pakai `node:sqlite`: tanpa dependency native, sudah tersedia di Node 22+,
 * dan file DB-nya gampang dimigrasi ke Postgres/Supabase nanti. Semua akses
 * data lewat modul ini supaya mudah diganti implementasinya.
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { databasePath } from "./env.ts";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string | null; // null = user login via OAuth (tanpa password)
  plan: string;
  created_at: number;
}

export interface ProjectRow {
  id: string;
  user_id: string;
  title: string;
  idea: string;
  model_id: string;
  language: string;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface MessageRow {
  id: string;
  project_id: string;
  role: string;
  content_enc: string;
  created_at: number;
}

export interface PrdRow {
  id: string;
  project_id: string;
  content_enc: string;
  version: number;
  created_at: number;
  updated_at: number;
}

export interface OrderRow {
  id: string;
  user_id: string;
  plan: string;
  amount_idr: number;
  status: string;
  provider: string;
  provider_ref: string;
  created_at: number;
  updated_at: number;
}

export interface BookingRow {
  id: string;
  user_id: string;
  topic: string;
  contact: string;
  preferred_date: string;
  status: string;
  order_id: string;
  created_at: number;
  updated_at: number;
}

export interface UsageRow {
  id: string;
  user_id: string;
  project_id: string | null;
  kind: string;
  provider: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  created_at: number;
}

export interface SessionRow {
  id: string;
  user_id: string;
  created_at: number;
  expires_at: number;
}

interface GlobalWithDb {
  __myprdDb?: DatabaseSync;
}

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  password_hash TEXT, -- nullable: user OAuth tidak punya password
  plan          TEXT NOT NULL DEFAULT 'free',
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  idea       TEXT NOT NULL DEFAULT '',
  model_id   TEXT NOT NULL,
  language   TEXT NOT NULL DEFAULT 'id',
  status     TEXT NOT NULL DEFAULT 'chatting',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  content_enc TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id, created_at);

CREATE TABLE IF NOT EXISTS prds (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content_enc TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_prds_project ON prds(project_id);

CREATE TABLE IF NOT EXISTS usage_events (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT,
  kind       TEXT NOT NULL,
  provider   TEXT NOT NULL,
  model      TEXT NOT NULL,
  tokens_in  INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_usd   REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_user_time ON usage_events(user_id, created_at);

CREATE TABLE IF NOT EXISTS orders (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan         TEXT NOT NULL,
  amount_idr   INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  provider     TEXT NOT NULL DEFAULT 'mock',
  provider_ref TEXT NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bookings (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic          TEXT NOT NULL,
  contact        TEXT NOT NULL DEFAULT '',
  preferred_date TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'pending_payment',
  order_id       TEXT NOT NULL DEFAULT '',
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_order ON bookings(order_id) WHERE order_id <> '';

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`;

function initDb(): DatabaseSync {
  // turbopackIgnore: path DB bisa dikonfigurasi lewat DATABASE_PATH, dan tanpa
  // penanda ini Turbopack menganggap seluruh project ikut ter-trace ke output build.
  const file = path.resolve(/*turbopackIgnore: true*/ process.cwd(), databasePath());
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  sweepStaleUsageReservations(db);
  sweepExpiredSessions(db);
  migrateUsersPasswordNullable(db);
  return db;
}

/**
 * Bersihkan reservasi kuota yang menggantung (proses mati atau klien putus
 * sebelum stream mulai) supaya kuota user tidak ikut terpotong. Reservasi
 * ditandai `provider = ''`; generate sungguhan tidak pernah menggantung lebih
 * dari satu jam (watchdog diam default 120 detik).
 */
function sweepStaleUsageReservations(db: DatabaseSync): void {
  db.prepare("DELETE FROM usage_events WHERE kind = 'prd' AND provider = '' AND created_at < ?").run(
    Date.now() - 60 * 60 * 1000,
  );
}

/** Buang sesi yang sudah kedaluwarsa supaya tabelnya tidak tumbuh terus. */
function sweepExpiredSessions(db: DatabaseSync): void {
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
}

/**
 * Migrasi sekali jalan: DB lama punya `password_hash NOT NULL`, rebuild
 * tabel agar user OAuth (tanpa password) bisa disimpan sebagai NULL.
 * No-op untuk DB baru maupun yang sudah termigrasi.
 */
export function migrateUsersPasswordNullable(db: DatabaseSync): void {
  const cols = db.prepare("PRAGMA table_info(users)").all() as { name: string; notnull: number }[];
  if (cols.find((c) => c.name === "password_hash")?.notnull !== 1) return;
  db.exec(`
    PRAGMA foreign_keys = OFF;
    CREATE TABLE users_new (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL DEFAULT '',
      password_hash TEXT,
      plan          TEXT NOT NULL DEFAULT 'free',
      created_at    INTEGER NOT NULL
    );
    INSERT INTO users_new (id, email, name, password_hash, plan, created_at)
      SELECT id, email, name, password_hash, plan, created_at FROM users;
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
    PRAGMA foreign_keys = ON;
  `);
}

export function getDb(): DatabaseSync {
  const g = globalThis as unknown as GlobalWithDb;
  if (!g.__myprdDb) {
    g.__myprdDb = initDb();
  }
  return g.__myprdDb;
}

export function startOfMonthMs(reference = Date.now()): number {
  const d = new Date(reference);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
