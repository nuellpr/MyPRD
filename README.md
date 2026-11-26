# MyPRD — Dari Ide Jadi PRD & Task Siap Eksekusi

Platform web beranimasi penuh untuk developer Indonesia: ubah ide produk menjadi **PRD terstruktur 12 bagian**, **diagram arsitektur Mermaid**, **skema database**, **Mindmap Roadmap**, dan **Kanban Task Breakdown** siap tempel ke AI coding agent (Claude Code, Cursor, Windsurf, Codex, OpenCode).

---

## Fitur Utama

| Fitur | Ringkasan |
|---|---|
| **Composer & Plan Wizard 3 Langkah** | Composer beranda/dashboard (`Template`, `@ Referensi`, toggle bahasa `ID/EN`, dikte suara) terhubung ke wizard terpandu (`1. Ide → 2. PRD → 3. Task`) berisi **Preferensi teknologi** & **5 pertanyaan klarifikasi** adaptif. |
| **Workspace 3 Tampilan (`Wiki \| Roadmap \| Lihat Task`)** | Split workspace lengkap dengan **Roadmap Mindmap** pan/zoom dot-grid (`Project Root` → kartu `FASE` → `SUB FITUR` → checkbox task), **Wiki** dengan Daftar Isi sticky & diagram **Mermaid SVG** interaktif, serta **Kanban 4 kolom** (`Belum mulai`, `Dikerjakan`, `Selesai`, `Gagal`) + filter fitur & aksi massal. |
| **Workspace Agent & Modal Implemen** | Sidebar `✨ Revisi PRD` (update PRD & naikkan versi `#v` secara langsung) / `💬 Diskusi`, plus modal **Implemen** berisi prompt siap eksekusi + ekspor `.md`, `tasks.md`, `tasks.json`, dan `.pdf`. |
| **Multi-Provider AI Router** | Mendukung **BangunWeb AI Router** (`https://router.bangunweb.com/v1`), Google Gemini, OpenAI, OpenRouter, DeepSeek, Kimi, Qwen, Groq, `custom` (OpenAI-compatible), plus provider `mock` untuk demo tanpa API key. |
| **Billing QRIS Dinamis + Gateway** | Mendukung **QRIS Dinamis** (mengubah QRIS statis merchant menjadi QRIS dinamis berkode unik 3 digit + CRC16 EMVCo, lengkap dengan konfirmasi pembeli & verifikasi admin), serta **Mayar V2**, **Midtrans Snap**, dan mode `mock`. |
| **Keamanan & Auth Modern** | Register/login + **OTP 6 digit**, Google OAuth opsional, reset password via email Resend, sesi revocable di tabel `sessions`, enkripsi at-rest `AES-256-GCM` untuk chat & PRD, serta rate limiting & proteksi prompt injection. |

---

## Menjalankan Secara Lokal

Butuh **Node.js 22+** (disarankan Node 24 — memakai `node:sqlite` bawaan tanpa dependency native).

```bash
npm install
cp .env.example .env.local   # atau .env, lalu isi APP_SECRET
npm run dev
```

Buka `http://localhost:3000`. Tanpa API key AI, aplikasi otomatis menyediakan mode `mock` sehingga seluruh alur wizard, Mermaid, Kanban, dan ekspor tetap bisa diuji.

### Skrip Pengujian & Build

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # node --test (seluruh unit test)
npm run build       # build produksi Next.js 16 (Turbopack)
npm run smoke       # uji E2E end-to-end di port 3210 (butuh build dulu)
npm run e2e:live    # uji E2E dengan provider AI asli (default BangunWeb)
```

---

## Konfigurasi Penting (`.env` / `.env.local`)

- **Keamanan:** `APP_SECRET` (wajib minimal 16 karakter di production) dan `DATABASE_PATH=data/myprd.db`.
- **AI Provider (contoh BangunWeb AI Router):**
  ```env
  AI_DEFAULT_MODEL=bangunweb/bw-swift
  BANGUNWEB_BASE_URL=https://router.bangunweb.com/v1
  BANGUNWEB_API_KEY=bwr_live_...
  BANGUNWEB_MODELS=bw-swift,deepseek-v4.1-flash,gpt-5.4-mini,gpt-6.2-astra,gpt-6.2-sol
  ```
- **Billing QRIS Dinamis:**
  ```env
  BILLING_PROVIDER=qris
  QRIS_STATIC_PAYLOAD=000201010211...
  ADMIN_EMAILS=admin@domainmu.com
  ```

---

## Struktur Direktori Inti

```text
app/
  (auth)/                      login, register, verifikasi-otp, lupa-password, reset-password
  api/                         auth, models, projects (chat/questions/generate/revise/prd/export), billing (checkout/qris-detail/qris-confirm/admin-approve/webhook), settings
  dashboard/[id]/              workspace PRD 3 tampilan + PlanWizard
  billing/, settings/, templates/, komunitas/
components/
  workspace/                   PlanWizard, RoadmapCanvas, PrdWikiView, MermaidDiagram, TaskKanban, WorkspaceAgent, ImplementModal
  auth/, dashboard/, home/, motion/, templates/
lib/
  ai.ts, auth.ts, billing.ts, qris.ts, crypto.ts, db.ts, repo.ts, env.ts, prd.ts, questions.ts, roadmap.ts, tasks.ts, pdf.ts, plans.ts
```
