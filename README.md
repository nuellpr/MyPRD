# MyPRD — dari ide ke PRD siap eksekusi

Platform web untuk developer Indonesia: ubah ide produk menjadi **PRD terstruktur + task breakdown** yang siap ditempel ke AI coding agent (Claude Code, Cursor, OpenCode).

Dibangun sesuai `PRD-Platform-Bikin-PRD-AI-Coding.md`, fokus pada **Fase 1 MVP**: auth, chat AI → generator PRD, export markdown/PDF, landing page, dan pricing (free tier aktif).

---

## Fitur MVP

| Fitur | Status | Catatan |
|---|---|---|
| Generator PRD via AI chat | ✅ | AI **bertanya dulu** (maks 3 pertanyaan klarifikasi) sebelum menyusun PRD — tidak menebak |
| Multi-model AI | ✅ | Router OpenAI-compatible: **Google Gemini**, OpenAI, OpenRouter, DeepSeek, Kimi, Qwen, Groq, custom. Plus provider **mock** untuk demo tanpa API key |
| PRD terstruktur 12 bagian | ✅ | Ringkasan, masalah, tujuan, target user, scope, fitur, user flow, non-fungsional, tech stack, acceptance criteria, task breakdown, pertanyaan terbuka |
| Task breakdown untuk AI agent | ✅ | Format `- [ ] T1 — judul \| file: path \| depends: T0 \| kompleksitas: S/M/L`; parser + topological sort + export checklist/JSON |
| Editor & preview PRD | ✅ | Edit markdown langsung, preview render (GFM), tombol Simpan |
| Export | ✅ | Markdown, JSON, checklist task `.md`, task `.json`, dan print → PDF dari browser |
| Auth | ✅ | Email + password (scrypt), sesi cookie httpOnly bertanda tangan HMAC |
| Riwayat project | ✅ | Dashboard berisi daftar PRD dengan status & model terakhir |
| Kuota free tier | ✅ | Dihitung dari usage per bulan, blokir 402 + pesan upgrade saat habis |
| Pricing | ✅ | 3 tier (Free/Starter/Pro) di landing page |
| Keamanan | ✅ | Enkripsi at-rest AES-256-GCM untuk chat & PRD, rate limiting, proteksi prompt injection, sanitasi input |
| Monitoring biaya AI | ✅ | Tabel `usage_events` menyimpan token & estimasi biaya per request |
| Billing (Midtrans/Xendit) | ⏳ Fase 2 | Struktur `plans` & kolom `users.plan` sudah siap |
| Komunitas Discord / konsultasi | ⏳ Fase 3 | Link tersedia di footer |

---

## Menjalankan lokal

Butuh **Node.js 22+** (dites di Node 24) — memakai modul bawaan `node:sqlite`, jadi tidak ada dependency native.

```bash
npm install
cp .env.example .env.local     # lalu isi APP_SECRET
npm run dev
```

Buka http://localhost:3000. Tanpa API key AI, aplikasi otomatis memakai provider **mock** sehingga seluruh alur (chat → generate PRD → export) tetap bisa dicoba.

Generate `APP_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Perintah lain

```bash
npm run build      # build produksi
npm start          # jalankan hasil build
npm test           # unit test (node --test, tanpa dependency test tambahan)
npm run smoke      # smoke test end-to-end (build + start di port 3210 + 43 pemeriksaan alur utama)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

---

## Konfigurasi AI

Format model: `provider/model`, contoh `gemini/gemini-3.5-flash-lite`. Isi API key di `.env.local`; provider tanpa key otomatis disembunyikan dari pemilihan model.

```env
GEMINI_API_KEY=AIza...
AI_DEFAULT_MODEL=gemini/gemini-3.5-flash-lite
```

Provider yang didukung: `gemini`, `openai`, `openrouter`, `deepseek`, `kimi`, `qwen`, `groq`, dan `custom` (OpenAI-compatible apa pun lewat `CUSTOM_BASE_URL`). Semua lewat endpoint `POST {baseUrl}/chat/completions` dengan `stream: true`.

### Google Gemini

Gemini dipakai lewat **endpoint OpenAI-compatible resmi** Google (`https://generativelanguage.googleapis.com/v1beta/openai`), jadi tidak ada SDK tambahan. Ambil API key gratis di [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

```env
GEMINI_API_KEY=AIza...
GEMINI_MODELS=gemini-3.5-flash-lite,gemini-3.5-flash,gemini-2.5-flash
AI_DEFAULT_MODEL=gemini/gemini-3.5-flash-lite
```

Alias `GOOGLE_API_KEY` dan `GEMINI` juga dikenali. Model `gemini-3.5-flash-lite` cocok untuk kuota free tier (cepat + murah: ~$0.30/1M token input, ~$2.50/1M output); pakai `gemini-3.5-flash` bila butuh kualitas lebih tinggi.

Biaya per 1 juta token tiap provider didefinisikan di `lib/env.ts` dan dipakai untuk estimasi biaya di `usage_events`.

---

## Arsitektur

```
app/
  page.tsx                     landing + pricing + FAQ
  login/, register/            autentikasi
  dashboard/page.tsx           daftar project + sisa kuota
  dashboard/[id]/page.tsx      workspace: chat streaming + panel PRD
  api/auth/*                   register, login, logout, me
  api/models/                  daftar provider & model yang tersedia
  api/projects/                CRUD project
  api/projects/[id]/chat/      POST → SSE streaming balasan AI
  api/projects/[id]/generate/  POST → SSE streaming PRD final (cek kuota)
  api/projects/[id]/prd/       GET/PUT simpan PRD hasil edit
  api/projects/[id]/export/    download markdown/json/task
components/                    UI (Workspace, MarkdownView, PricingCards, ...)
lib/
  env.ts         katalog provider + konfigurasi
  ai.ts          router multi-provider + provider mock streaming
  prd.ts         system prompt & helper parsing PRD
  tasks.ts       parser task breakdown + topological sort + export
  db.ts          skema SQLite (node:sqlite)
  repo.ts        repository project/message/prd/usage
  auth.ts        sesi & password
  crypto.ts      scrypt, HMAC session, AES-256-GCM
  safety.ts      sanitasi input & anti prompt injection
  rate-limit.ts  sliding window in-memory
  http.ts        helper response JSON/SSE
proxy.ts                       proteksi route /dashboard (cek cookie)
```

### Alur utama

1. **Register/login** → cookie sesi httpOnly (30 hari).
2. **Bikin PRD Baru** → isi ide + pilih model → project dibuat dengan status `chatting`. Ide yang kamu tulis langsung terkirim sebagai pesan pertama di chat (tidak perlu mengetik ulang).
3. **Chat** (`/chat`, SSE) → AI mengajukan pertanyaan klarifikasi; saat informasi cukup ia menutup balasan dengan `[[SIAP_PRD]]` (marker dibuang sebelum ditampilkan). Tombol **Generate PRD** berubah hijau + badge "Siap disusun" muncul begitu AI menyatakan siap.
4. **Generate PRD** (`/generate`, SSE) → kuota dicek lebih dulu, PRD disimpan terenkripsi, judul project otomatis diambil dari H1 PRD, status jadi `prd_ready`.
5. **Review/edit** → simpan (versi naik) → **Export** markdown/JSON/PDF atau checklist task.

### Keamanan & batasan

- **Enkripsi at-rest**: isi pesan chat dan PRD disimpan sebagai ciphertext AES-256-GCM (`v1.iv.tag.ct`), key diturunkan dari `APP_SECRET`.
- **Anti prompt injection**: pesan user dibungkus `<pesan_user>…</pesan_user>` dengan catatan eksplisit bahwa isinya data, marker internal `[[SIAP_PRD]]` dibuang dari input user, panjang input dibatasi (chat 6.000 / ide 8.000 / PRD 200.000 karakter).
- **Rate limit**: AI 20 req/menit per user, auth 10 percobaan/5 menit per IP. In-memory (single node) — ganti ke Redis untuk scale horizontal.
- **Otorisasi**: semua query project selalu di-scope `user_id`, jadi user lain tidak bisa membaca project orang lain.
- **APP_SECRET wajib** minimal 16 karakter di production (aplikasi menolak start kalau kosong).

### Ketahanan streaming (provider free tier)

Provider seperti Gemini free tier kadang butuh waktu lama sebelum token pertama, atau berhenti di tengah stream tanpa menutup koneksi. Yang dilakukan aplikasi:

- **Heartbeat SSE**: event `{type:"ping"}` dikirim tiap 10 detik selama model belum mengeluarkan token, sehingga koneksi tidak diputus proxy/browser. UI menampilkan indikator "Model sedang menyiapkan balasan" beserta hitungan detik.
- **Watchdog diam** (`AI_IDLE_TIMEOUT_MS`, default 120 detik): kalau provider tidak mengirim data selama itu, request dibatalkan.
- **Draf parsial disimpan**: kalau PRD/balasan yang sudah diterima berbentuk substansial, hasilnya tetap disimpan sebagai draf + pesan peringatan di UI (kuota tetap terhitung), sehingga user tinggal menekan Generate PRD lagi untuk melengkapi. Sebelumnya hasil parsial dibuang dan menunggu timeout 300 detik.

---

## Data

SQLite di `data/myprd.db` (di-gitignore). Tabel: `users`, `projects`, `messages`, `prds`, `usage_events`. Untuk pindah ke Postgres/Supabase, cukup ganti `lib/db.ts` — seluruh akses data lewat `lib/repo.ts`.

Kuota bulanan dihitung dari `COUNT(*) usage_events WHERE kind = 'prd' AND created_at >= awal bulan`, sehingga reset otomatis tanpa job terjadwal.

---

## Roadmap

- **Fase 2** — billing Midtrans/Xendit + Stripe, template & starter kit (Next.js+Supabase, FastAPI+Postgres), integrasi repo Git.
- **Fase 3** — Discord bot & leaderboard, booking konsultasi + pembayaran di muka, eksekusi task otomatis.
