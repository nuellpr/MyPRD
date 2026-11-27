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
  default_model_id: string;
  phone: string;
  bio: string;
  avatar_url: string;
  two_factor_enabled: number;
  email_verified: number;
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
  agent_token_enc?: string | null;
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
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
PRAGMA temp_store = MEMORY;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id                 TEXT PRIMARY KEY,
  email              TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL DEFAULT '',
  password_hash      TEXT, -- nullable: user OAuth tidak punya password
  plan               TEXT NOT NULL DEFAULT 'free',
  default_model_id   TEXT NOT NULL DEFAULT '',
  phone              TEXT NOT NULL DEFAULT '',
  bio                TEXT NOT NULL DEFAULT '',
  avatar_url         TEXT NOT NULL DEFAULT '',
  two_factor_enabled INTEGER NOT NULL DEFAULT 0,
  email_verified     INTEGER NOT NULL DEFAULT 1,
  created_at         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  idea            TEXT NOT NULL DEFAULT '',
  model_id        TEXT NOT NULL,
  language        TEXT NOT NULL DEFAULT 'id',
  status          TEXT NOT NULL DEFAULT 'chatting',
  agent_token_enc TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
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
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_reset_expires ON password_reset_tokens(expires_at);

CREATE TABLE IF NOT EXISTS otp_codes (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  purpose    TEXT NOT NULL,
  code_hash  TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER,
  attempts   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_codes(expires_at);

CREATE TABLE IF NOT EXISTS auth_lockouts (
  key          TEXT PRIMARY KEY,
  failed_count INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_lockouts_until ON auth_lockouts(locked_until);
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
  sweepPasswordResetTokens(db);
  sweepOtpCodes(db);
  sweepExpiredLockouts(db);
  migrateUsersPasswordNullable(db);
  migrateUsersDefaultModel(db);
  migrateUserProfile(db);
  migrateEmailVerified(db);
  migrateProjectAgentToken(db);
  migrateUserAvatarAnd2fa(db);
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
 *
 * Dilakukan dalam satu transaksi: `DROP TABLE users` lewat `ON DELETE
 * CASCADE` ke projects/messages/... adalah destruktif, jadi kalau proses
 * mati di tengah, DB harus tetap utuh (bukan setengah jadi tanpa tabel users
 * — yang di boot berikutnya akan dibuat ulang kosong oleh SCHEMA).
 */
export function migrateUsersPasswordNullable(db: DatabaseSync): void {
  const cols = db.prepare("PRAGMA table_info(users)").all() as { name: string; notnull: number }[];
  if (cols.find((c) => c.name === "password_hash")?.notnull !== 1) return;
  // PRAGMA foreign_keys tidak berlaku di dalam transaksi, jadi dimatikan dulu.
  db.exec("PRAGMA foreign_keys = OFF");
  try {
    db.exec(`
      BEGIN;
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
      COMMIT;
    `);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

/** Migrasi aditif: simpan model AI default pilihan user. */
export function migrateUsersDefaultModel(db: DatabaseSync): void {
  const cols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (cols.some((c) => c.name === "default_model_id")) return;
  db.exec("ALTER TABLE users ADD COLUMN default_model_id TEXT NOT NULL DEFAULT ''");
}

/** Migrasi aditif: kolom detail profil (telepon & bio). */
export function migrateUserProfile(db: DatabaseSync): void {
  const cols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "phone")) db.exec("ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT ''");
  if (!cols.some((c) => c.name === "bio")) db.exec("ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''");
}

/** Bersihkan token reset yang sudah kedaluwarsa atau terpakai (> 1 hari). */
function sweepPasswordResetTokens(db: DatabaseSync): void {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  db.prepare("DELETE FROM password_reset_tokens WHERE expires_at < ? OR (used_at IS NOT NULL AND used_at < ?)").run(cutoff, cutoff);
}

/** Bersihkan kode OTP yang kedaluwarsa atau terpakai (> 1 hari). */
function sweepOtpCodes(db: DatabaseSync): void {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  db.prepare("DELETE FROM otp_codes WHERE expires_at < ? OR (used_at IS NOT NULL AND used_at < ?)").run(cutoff, cutoff);
}

/** Migrasi aditif: flag verifikasi email (user lama dianggap terverifikasi). */
export function migrateEmailVerified(db: DatabaseSync): void {
  const cols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "email_verified")) {
    db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1");
  }
}

/** Migrasi aditif: kolom token terenkripsi untuk sinkronisasi webhook AI agent. */
export function migrateProjectAgentToken(db: DatabaseSync): void {
  const cols = db.prepare("PRAGMA table_info(projects)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "agent_token_enc")) {
    db.exec("ALTER TABLE projects ADD COLUMN agent_token_enc TEXT");
  }
}

/** Bersihkan catatan lockout yang sudah kedaluwarsa lebih dari 24 jam. */
function sweepExpiredLockouts(db: DatabaseSync): void {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  db.prepare("DELETE FROM auth_lockouts WHERE locked_until > 0 AND locked_until < ?").run(cutoff);
}

/** Migrasi aditif: kolom foto profil dan flag 2FA pada user. */
export function migrateUserAvatarAnd2fa(db: DatabaseSync): void {
  const cols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "avatar_url")) {
    db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''");
  }
  if (!cols.some((c) => c.name === "two_factor_enabled")) {
    db.exec("ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER NOT NULL DEFAULT 0");
  }
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
