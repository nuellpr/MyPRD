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
  password_hash: string;
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
  password_hash TEXT NOT NULL,
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
`;

function initDb(): DatabaseSync {
  const file = path.resolve(process.cwd(), databasePath());
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return db;
}

export function getDb(): DatabaseSync {
  const g = globalThis as unknown as GlobalWithDb;
  if (!g.__myprdDb) {
    g.__myprdDb = initDb();
  }
  return g.__myprdDb;
}

/** Untuk test: buat DB in-memory terpisah dengan skema yang sama. */
export function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(SCHEMA);
  return db;
}

export function nowMs(): number {
  return Date.now();
}

export function startOfMonthMs(reference = Date.now()): number {
  const d = new Date(reference);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
