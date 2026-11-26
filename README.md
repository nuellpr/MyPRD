<div align="center">

<img src="public/logo-mark.png" alt="MyPRD Logo" width="120" />

# MyPRD

**Dari Ide Jadi PRD, Roadmap & Task Siap Eksekusi untuk AI Coding Agent**

[![CI](https://github.com/nuellpr/MyPRD/actions/workflows/ci.yml/badge.svg)](https://github.com/nuellpr/MyPRD/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js-22%2B%20%2F%2024-339933?logo=node.js&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-node%3Asqlite-003B57?logo=sqlite&logoColor=white)

</div>

---

**MyPRD** adalah platform web beranimasi penuh untuk developer Indonesia yang mengubah ide produk mentah menjadi **PRD terstruktur 12 bagian**, **diagram arsitektur Mermaid**, **skema database**, **Mindmap Roadmap**, dan **Kanban Task Breakdown** siap tempel ke AI coding agent (Claude Code, Cursor, Windsurf, Codex, OpenCode).

---

## Alur Kerja

```text
Ide Produk  ──▶  Plan Wizard (Stack + 5 Klarifikasi)  ──▶  PRD 12 Bagian (#v1)
                                                                  │
   AI Coding Agent ◀── Modal Implemen (.md / .json / .pdf) ◀──────┴── Wiki · Roadmap Mindmap · Kanban
```

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

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack), React 19, TypeScript
- **Animasi & Visual:** Motion (`motion/react`), Mermaid v12, Tailwind CSS v4
- **Database & Keamanan:** SQLite (`node:sqlite` bawaan Node 22+/24, WAL mode), `AES-256-GCM`, `scrypt`
- **Ekspor & Pembayaran:** `pdf-lib`, `qrcode` (EMVCo QRIS CRC16), Mayar V2, Midtrans Snap

---

## Roadmap

```mermaid
flowchart LR
    F1["✅ Fase 1: Fondasi & Auth<br/>• Register/Login + OTP 6 Digit<br/>• Google OAuth & Reset Password<br/>• Enkripsi AES-256-GCM + Sesi"]
    F2["✅ Fase 2: Workspace & Multi-AI<br/>• Composer + Plan Wizard 3 Langkah<br/>• Wiki Mermaid, Mindmap & Kanban<br/>• BangunWeb AI Router & Multi-Provider"]
    F3["✅ Fase 3: Billing & Optimasi<br/>• QRIS Statis → Dinamis (CRC16)<br/>• Optimasi Aset & SQLite WAL<br/>• GitHub Actions CI Otomatis"]
    F4["🔜 Fase 4: Rencana Berikutnya<br/>• Auto-Verify Mutasi QRIS Webhook<br/>• Kolaborasi Tim & Diff Versi #v<br/>• Ekspor ke GitHub Issues / Linear"]

    F1 --> F2 --> F3 --> F4

    style F1 fill:#0f291e,stroke:#22c55e,color:#ecfdf5
    style F2 fill:#0f291e,stroke:#22c55e,color:#ecfdf5
    style F3 fill:#0f291e,stroke:#22c55e,color:#ecfdf5
    style F4 fill:#1e1b4b,stroke:#818cf8,color:#eef2ff
```

<details>
<summary>Detail checklist tiap fase</summary>

- **Fase 1 — Fondasi & Auth (Selesai):** Register/login + password strength meter, verifikasi OTP 6 digit, reset password, Google OAuth opsional, sesi revocable, dan enkripsi at-rest `AES-256-GCM`.
- **Fase 2 — Guided PRD Workspace & Multi-AI (Selesai):** Composer (`Template`, `@ Referensi`, `ID/EN`, dikte suara), Plan Wizard 3 langkah, Wiki Mermaid + Roadmap Mindmap + Kanban, Workspace Agent (`Revisi PRD` `#v` & `Diskusi`), Modal Implemen, serta BangunWeb AI Router (`gpt-6.2-astra`, `gpt-6.2-sol`), Gemini, OpenAI, OpenRouter, DeepSeek, Kimi, Qwen, Groq, dan `mock`.
- **Fase 3 — Billing QRIS Dinamis, Optimasi & CI (Selesai):** Konverter QRIS Statis → Dinamis (kode unik 3 digit + CRC16 EMVCo) + konfirmasi & admin approve, optimasi gambar/header Next.js/SQLite WAL, dan GitHub Actions CI.
- **Fase 4 — Rencana Berikutnya:** Verifikasi mutasi QRIS otomatis via webhook, kolaborasi tim multi-user & diff antar versi `#v`, serta ekspor langsung ke GitHub Issues / Linear.

</details>

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
npm run typecheck   # next typegen && tsc --noEmit
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
