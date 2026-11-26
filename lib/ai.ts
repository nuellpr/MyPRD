/**
 * Router AI multi-provider.
 *
 * Semua provider yang dipakai berbicara protokol OpenAI-compatible
 * (`POST {baseUrl}/chat/completions` dengan `stream: true`), jadi menambah
 * provider baru cukup menambah entri di `lib/env.ts`.
 */
import { aiIdleTimeoutMs, findProvider, parseModelId, type ProviderConfig } from "./env.ts";
import { estimateTokens } from "./plans.ts";
import { buildFallbackQuestions } from "./questions.ts";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamUsage {
  tokensIn: number;
  tokensOut: number;
  provider: string;
  model: string;
}

export interface StreamOptions {
  modelId: string;
  messages: ChatMessage[];
  maxOutputTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface StreamResult {
  stream: AsyncIterable<string>;
  usage: Promise<StreamUsage>;
}

export class ModelError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ModelError";
    this.status = status;
  }
}

export class StreamStalledError extends ModelError {
  constructor(message = "Model berhenti mengirim data (koneksi macet).") {
    super(message, 504);
    this.name = "StreamStalledError";
  }
}

function resolve(modelId: string): { provider: ProviderConfig; model: string } {
  const parsed = parseModelId(modelId);
  if (!parsed) throw new ModelError(`Format model tidak valid: "${modelId}". Gunakan "provider/model".`);
  const provider = findProvider(parsed.providerId);
  if (!provider) throw new ModelError(`Provider "${parsed.providerId}" tidak tersedia atau API key belum diisi.`, 503);
  if (provider.id !== "mock" && !provider.apiKey) {
    throw new ModelError(`Provider "${provider.id}" belum dikonfigurasi (API key kosong).`, 503);
  }
  return { provider, model: parsed.model };
}

function cleanUserContent(raw: string): string {
  return raw
    .replace(/<pesan_user>|<\/pesan_user>/g, " ")
    .replace(/\(Catatan: seluruh isi[\s\S]*$/i, " ")
    .replace(/^Ide produk awal dari user:\s*/i, "")
    .replace(/^Ide produk saya:\s*/i, "")
    .replace(/^Susun PRD dari ide berikut:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildMockPrd(shortIdea: string, idea: string): string {
  return [
    `# PRD: ${shortIdea}`,
    "",
    "> Dihasilkan oleh provider **mock** (mode demo tanpa API key). Isi `.env.local` dengan API key provider asli untuk hasil sungguhan.",
    "",
    "## Ringkasan Produk",
    `Produk ini dibangun dari ide berikut: "${idea || "(ide belum diisi)"}".`,
    "Tujuannya menyelesaikan masalah utama pengguna dengan alur terstruktur yang langsung bisa dipakai tanpa pelatihan rumit, dengan data tersimpan rapi dan aman.",
    "",
    "## Latar Belakang & Masalah",
    "- Proses manual yang dipakai sekarang lambat, tersebar di beberapa chat, dan mudah salah catat.",
    "- Data pelanggan dan riwayat aktivitas sulit dipantau secara real-time saat dibutuhkan.",
    "- Solusi yang ada terlalu kompleks atau mahal untuk pengguna dengan perangkat terbatas.",
    "",
    "## Tujuan",
    "- Tujuan bisnis: memvalidasi permintaan pasar dengan rilis MVP bertahap dalam hitungan minggu.",
    "- Tujuan produk: pengguna mencapai nilai utama kurang dari 5 menit setelah membuka aplikasi.",
    "",
    "## Target Pengguna",
    "| Persona | Deskripsi | Kebutuhan Utama |",
    "|---|---|---|",
    "| Pengguna utama | Memakai alur inti setiap hari dari HP/browser | Aksi cepat, tampilan jelas, status real-time |",
    "| Pengelola / Admin | Mengatur katalog, pesanan, dan memantau rekap | Dashboard operasional, kontrol data, export |",
    "",
    "## Ruang Lingkup (In/Out of Scope)",
    "- **In scope:** autentikasi, alur inti produk, pelacakan status, dashboard pengelola, export data.",
    "- **Out of scope (fase awal):** aplikasi mobile native terpisah, marketplace multi-vendor terbuka.",
    "",
    "## Fitur Utama",
    "1. **Katalog & Pencarian** — Pengguna menelusuri daftar item, mencari kata kunci, dan memfilter kategori dengan cepat | sub: Daftar Item, Pencarian & Filter, Halaman Detail",
    "2. **Alur Transaksi Inti** — Pengguna menyelesaikan aksi utama (keranjang / pesanan / entri) dalam maksimal 3 langkah | sub: Form Input Cepat, Ringkasan & Validasi, Konfirmasi Aksi",
    "3. **Pembayaran & Status** — Pencatatan pembayaran (QRIS / transfer) serta pembaruan status real-time | sub: Pilih Metode Bayar, Status Pembayaran, Riwayat & Struk",
    "4. **Pelacakan & Notifikasi** — Pengguna memantau progres dan menerima kabar perubahan status otomatis | sub: Timeline Status, Salin Nomor Referensi, Notifikasi Perubahan",
    "5. **Dashboard Pengelola** — Admin mengelola item, stok, dan memproses permintaan masuk dari satu layar | sub: Kelola Item & Stok, Proses Permintaan, Rekap Laporan",
    "6. **Akun & Keamanan** — Pendaftaran, login terenkripsi, serta pengaturan profil dan peran | sub: Daftar & Login, Verifikasi OTP, Pengaturan Profil",
    "",
    "### Urutan Rilis Sesuai Fase",
    "- **Fase 1:** Fondasi project, skema database, dan katalog/daftar data utama.",
    "- **Fase 2:** Alur transaksi inti, pembayaran, dan pelacakan status.",
    "- **Fase 3:** Riwayat pengguna, notifikasi otomatis, dan filter lanjutan.",
    "- **Fase 4:** Dashboard pengelola lengkap, akun & peran, serta pengujian end-to-end.",
    "",
    "## User Flow",
    "1. Pengguna membuka halaman utama dan langsung mencoba/melihat alur inti.",
    "2. Pengguna memilih item atau mengisi form utama lalu mengonfirmasi transaksi.",
    "3. Sistem menyimpan data, memproses status, dan memberi pembaruan ke pengguna & admin.",
    "4. Pengelola memantau dan menindaklanjuti data masuk lewat dashboard.",
    "",
    "### Diagram Alur Utama",
    "```mermaid",
    "sequenceDiagram",
    '  participant U as "Pengguna"',
    '  participant W as "Aplikasi Web"',
    '  participant A as "API Server"',
    '  participant D as "Database"',
    "  U->>W: Buka aplikasi & pilih aksi utama",
    "  W->>A: Kirim request tervalidasi",
    "  A->>D: Simpan transaksi & status awal",
    "  D-->>A: Konfirmasi tersimpan",
    "  A-->>W: Kembalikan status & ringkasan",
    "  W-->>U: Tampilkan status terbaru",
    "```",
    "",
    "## Kebutuhan Non-Fungsional",
    "- **Performa:** halaman utama tampil < 2 detik pada koneksi 4G.",
    "- **Keamanan:** data sensitif terenkripsi at-rest, validasi input ketat, dan rate limiting pada endpoint publik.",
    "- **Skalabilitas:** API layer stateless agar mudah di-scale horizontal.",
    "",
    "## Tech Stack",
    "| Bagian | Rekomendasi | Alasan |",
    "|---|---|---|",
    "| Frontend | Next.js (App Router) + TypeScript | Satu codebase full-stack, cepat & ramah SEO |",
    "| Styling | Tailwind CSS | Konsisten, cepat dirakit, responsif mobile-first |",
    "| Backend & DB | API Routes + SQLite / PostgreSQL | Ringan di awal dan mudah naik skala ke managed DB |",
    "| Auth & Security | Session cookie httpOnly + scrypt | Aman tanpa ketergantungan layanan eksternal wajib |",
    "",
    "### Arsitektur Sistem",
    "```mermaid",
    "flowchart LR",
    '  C["Browser / HP Pengguna"] --> N["Aplikasi Next.js"]',
    '  N --> API["API Routes & Validasi"]',
    '  API --> AUTH["Auth & Session"]',
    '  API --> DB["Database Relasional"]',
    '  API --> EXT["Notifikasi / Payment"]',
    "```",
    "",
    "### Database Schema",
    "```mermaid",
    "erDiagram",
    "  USERS ||--o{ ORDERS : membuat",
    "  PRODUCTS ||--o{ ORDER_ITEMS : termasuk",
    "  ORDERS ||--|{ ORDER_ITEMS : berisi",
    "  USERS {",
    "    text id PK",
    "    text name",
    "    text email",
    "    text role",
    "  }",
    "  PRODUCTS {",
    "    text id PK",
    "    text title",
    "    int price",
    "    int stock",
    "  }",
    "  ORDERS {",
    "    text id PK",
    "    text user_id FK",
    "    text status",
    "    int total_amount",
    "  }",
    "```",
    "",
    "#### Tabel `users`",
    "| Kolom | Tipe | Kegunaan |",
    "|---|---|---|",
    "| id | TEXT (PK) | Identitas unik pengguna |",
    "| name | TEXT | Nama tampilan pengguna atau pengelola |",
    "| email | TEXT (unik) | Email untuk masuk dan notifikasi |",
    "| password_hash | TEXT | Hash kata sandi terenkripsi scrypt |",
    "| role | TEXT | Peran: `user` atau `admin` |",
    "| created_at | INTEGER | Timestamp pendaftaran |",
    "",
    "#### Tabel `products`",
    "| Kolom | Tipe | Kegunaan |",
    "|---|---|---|",
    "| id | TEXT (PK) | Identitas unik item/produk |",
    "| title | TEXT | Nama item/layanan |",
    "| price | INTEGER | Harga satuan dalam rupiah |",
    "| stock | INTEGER | Sisa stok atau kuota tersedia |",
    "| is_active | INTEGER | Status aktif tampil di katalog |",
    "",
    "#### Tabel `orders`",
    "| Kolom | Tipe | Kegunaan |",
    "|---|---|---|",
    "| id | TEXT (PK) | Nomor referensi transaksi |",
    "| user_id | TEXT (FK) | Pemilik transaksi |",
    "| total_amount | INTEGER | Total nominal transaksi |",
    "| status | TEXT | Status: `pending`, `paid`, `processed`, `done` |",
    "| created_at | INTEGER | Timestamp transaksi dibuat |",
    "",
    "## Kriteria Selesai (Acceptance Criteria)",
    "- [ ] Pengguna baru dapat menyelesaikan alur inti tanpa bantuan admin.",
    "- [ ] Data pengguna dan transaksi hanya bisa diakses oleh pemilik atau admin yang berwenang.",
    "- [ ] Perubahan status langsung tercermin di halaman pelacakan dan dashboard.",
    "",
    "## Task Breakdown untuk AI Coding Agent",
    "- [ ] T1 — Setup project, linting, dan struktur folder | fitur: Akun & Keamanan | prioritas: utama | file: package.json | depends: none | kompleksitas: S",
    "- [ ] T2 — Skema database & migrasi awal (users, products, orders) | fitur: Akun & Keamanan | prioritas: utama | file: lib/db.ts | depends: T1 | kompleksitas: M",
    "- [ ] T3 — Endpoint autentikasi (register, login, logout, me) | fitur: Akun & Keamanan | prioritas: utama | file: app/api/auth/ | depends: T2 | kompleksitas: M",
    "- [ ] T4 — Halaman daftar & filter item dengan pencarian cepat | fitur: Katalog & Pencarian | prioritas: utama | file: app/page.tsx | depends: T2 | kompleksitas: M",
    "- [ ] T5 — Halaman detail item & preview informasi lengkap | fitur: Katalog & Pencarian | prioritas: penting | file: app/items/[id]/page.tsx | depends: T4 | kompleksitas: S",
    "- [ ] T6 — Komponen UI dasar (tombol, input, kartu, modal, toast) | fitur: Katalog & Pencarian | prioritas: penting | file: components/ui/ | depends: T1 | kompleksitas: M",
    "- [ ] T7 — API endpoint transaksi inti & validasi stok | fitur: Alur Transaksi Inti | prioritas: utama | file: app/api/orders/route.ts | depends: T2 | kompleksitas: M",
    "- [ ] T8 — Form & halaman konfirmasi alur transaksi inti | fitur: Alur Transaksi Inti | prioritas: utama | file: app/checkout/page.tsx | depends: T6, T7 | kompleksitas: L",
    "- [ ] T9 — Integrasi metode pembayaran QRIS / webhook status | fitur: Pembayaran & Status | prioritas: utama | file: app/api/billing/webhook/route.ts | depends: T7 | kompleksitas: L",
    "- [ ] T10 — Riwayat transaksi & halaman detail struk | fitur: Pembayaran & Status | prioritas: penting | file: app/orders/page.tsx | depends: T3, T9 | kompleksitas: M",
    "- [ ] T11 — Halaman pelacakan status dengan timeline progres | fitur: Pelacakan & Notifikasi | prioritas: penting | file: app/track/[id]/page.tsx | depends: T9 | kompleksitas: M",
    "- [ ] T12 — Pengiriman notifikasi perubahan status | fitur: Pelacakan & Notifikasi | prioritas: tambahan | file: lib/notify.ts | depends: T9 | kompleksitas: S",
    "- [ ] T13 — Halaman dashboard pengelola untuk kelola item & stok | fitur: Dashboard Pengelola | prioritas: utama | file: app/dashboard/page.tsx | depends: T3, T4 | kompleksitas: M",
    "- [ ] T14 — Panel proses pesanan & rekap laporan harian | fitur: Dashboard Pengelola | prioritas: penting | file: app/dashboard/orders/page.tsx | depends: T13, T7 | kompleksitas: M",
    "- [ ] T15 — Rate limiting, sanitasi input, & proteksi akses | fitur: Akun & Keamanan | prioritas: penting | file: lib/rate-limit.ts | depends: T3 | kompleksitas: M",
    "- [ ] T16 — Pengujian alur inti end-to-end & smoke test | fitur: Dashboard Pengelola | prioritas: tambahan | file: scripts/smoke.mjs | depends: T8, T14 | kompleksitas: M",
    "",
    "## Pertanyaan Terbuka",
    "- Metrik keberhasilan utama apa yang ingin dipantau di minggu pertama rilis?",
    "- Apakah perlu dukungan multi-cabang atau cukup satu pengelola di versi awal?",
  ].join("\n");
}

function buildMockRevision(systemContent: string, userContent: string): string {
  const marker = "PRD SAAT INI:\n";
  const idx = systemContent.indexOf(marker);
  const existing = idx >= 0 ? systemContent.slice(idx + marker.length).trim() : "";
  const reqMatch = userContent.match(/Permintaan revisi PRD:\s*([\s\S]*?)(?:\n\nKeluarkan|$)/i);
  const request = (reqMatch?.[1] ?? userContent).trim().slice(0, 140);
  if (!existing) return buildMockPrd("Revisi PRD", request);

  const nextIdNum = (existing.match(/\bT(\d+)\b/g) ?? []).reduce((max, tok) => {
    const n = Number(tok.slice(1));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0) + 1;

  const extraFeatureLine = `- **Revisi: ${request}** — Penambahan kebutuhan sesuai arahan terbaru di Workspace Agent | sub: Implementasi Revisi, Validasi & UI`;
  const extraTaskLine = `- [ ] T${nextIdNum} — Implementasikan revisi: ${request} | fitur: Revisi | prioritas: penting | file: app/ | depends: T1 | kompleksitas: M`;

  let updated = existing;
  if (/## Fitur Utama/i.test(updated)) {
    updated = updated.replace(/(## Fitur Utama\s*\n)/i, `$1${extraFeatureLine}\n`);
  }
  if (/## Task Breakdown[^\n]*\n/i.test(updated)) {
    updated = updated.replace(/(## Task Breakdown[^\n]*\n)/i, `$1${extraTaskLine}\n`);
  } else {
    updated += `\n\n## Task Breakdown untuk AI Coding Agent\n${extraTaskLine}`;
  }
  return updated;
}

/** Mock: jawaban PRD, pertanyaan wizard, dan revisi PRD deterministik untuk demo & test. */
async function* mockStream(messages: ChatMessage[]): AsyncIterable<string> {
  const systemText = messages.find((m) => m.role === "system")?.content ?? "";
  const userMessages = messages.filter((m) => m.role === "user");
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const isQuestions = systemText.includes("MODE: GENERATE_QUESTIONS");
  const isRevise = systemText.includes("MODE: REVISE_PRD");
  const isGenerate = systemText.includes("MODE: GENERATE_PRD");
  const userTurns = userMessages.length;

  const sourceMessage = isGenerate ? (userMessages[0]?.content ?? lastUser) : lastUser;
  const cleaned = cleanUserContent(sourceMessage);
  const idea = cleaned.slice(0, 400);

  const firstSentence = cleaned.split(/(?<=[.!?])\s/)[0] ?? cleaned;
  const shortIdea = (firstSentence.length >= 12 ? firstSentence : cleaned).slice(0, 60).trim() || "Produk Baru";

  let reply: string;
  if (isQuestions) {
    const lang = systemText.includes("English") ? "en" : "id";
    reply = JSON.stringify(buildFallbackQuestions(idea, lang));
  } else if (isRevise) {
    reply = buildMockRevision(systemText, lastUser);
  } else if (isGenerate) {
    reply = buildMockPrd(shortIdea, idea);
  } else if (userTurns >= 2) {
    reply = [
      "Terima kasih, informasinya sudah cukup jelas buat saya:",
      "",
      `- Masalah & target pengguna: ${idea || "(dari percakapan)"}`,
      "- Fitur inti dan batasan sudah disebutkan.",
      "",
      "Saya siap menyusun PRD lengkap beserta task breakdown-nya. Klik tombol **Generate PRD** di bawah panel ini.",
      "",
      "[[SIAP_PRD]]",
    ].join("\n");
  } else {
    reply = [
      "Saya bantu susun PRD-nya. Biar hasilnya pas, saya perlu tahu beberapa hal dulu:",
      "",
      `1. Dari ide "${idea || "(ide kamu)"}", siapa pengguna utama yang paling ingin dibantu?`,
      "2. Fitur apa yang **wajib ada** di versi pertama (maksimal 3)?",
      "3. Batasan apa yang perlu saya perhatikan (waktu rilis, budget, atau platform)?",
      "",
      "_Catatan: ini mode demo (provider mock). Isi API key di `.env.local` untuk memakai model AI asli._",
    ].join("\n");
  }

  const chunks = reply.match(/[\s\S]{1,48}/g) ?? [reply];
  for (const chunk of chunks) {
    await new Promise((r) => setTimeout(r, 15));
    yield chunk;
  }
}

async function* openAiCompatibleStream(
  provider: ProviderConfig,
  model: string,
  messages: ChatMessage[],
  options: StreamOptions,
  onUsage: (usage: StreamUsage) => void,
): AsyncIterable<string> {
  const idleMs = aiIdleTimeoutMs();
  const idleController = new AbortController();
  const combinedSignal = options.signal
    ? AbortSignal.any([options.signal, idleController.signal])
    : idleController.signal;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const resetIdle = () => {
    if (idleTimer !== undefined) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => idleController.abort(), idleMs);
  };
  const clearIdle = () => {
    if (idleTimer !== undefined) clearTimeout(idleTimer);
    idleTimer = undefined;
  };
  resetIdle();

  let res: Response;
  try {
    res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
        ...(provider.id === "openrouter" ? { "HTTP-Referer": "https://myprd.local", "X-Title": "MyPRD" } : {}),
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: options.temperature ?? 0.6,
        max_tokens: options.maxOutputTokens ?? 3000,
        stream_options: { include_usage: true },
      }),
      signal: combinedSignal,
    });
  } catch (error) {
    clearIdle();
    if (idleController.signal.aborted && !options.signal?.aborted) throw new StreamStalledError();
    throw error;
  }

  if (!res.ok || !res.body) {
    clearIdle();
    const detail = await res.text().catch(() => "");
    throw new ModelError(`Provider ${provider.id} gagal (${res.status}): ${detail.slice(0, 300) || res.statusText}`, 502);
  }

  const decoder = new TextDecoder();
  let buffer = "";

  const reader = res.body.getReader();
  try {
    while (true) {
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await reader.read();
      } catch (error) {
        if (idleController.signal.aborted && !options.signal?.aborted) throw new StreamStalledError();
        throw error;
      }
      resetIdle();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          const delta: string | undefined = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
          if (json.usage) {
            onUsage({
              tokensIn: json.usage.prompt_tokens ?? 0,
              tokensOut: json.usage.completion_tokens ?? 0,
              provider: provider.id,
              model,
            });
          }
        } catch {
          // Chunk tidak lengkap / bukan JSON — abaikan.
        }
      }
    }
  } finally {
    clearIdle();
    reader.releaseLock();
  }
}

export function streamChat(options: StreamOptions): StreamResult {
  const { provider, model } = resolve(options.modelId);
  let resolveUsage: (u: StreamUsage) => void = () => {};
  const usage = new Promise<StreamUsage>((resolve) => {
    resolveUsage = resolve;
  });

  if (provider.id === "mock") {
    const stream = (async function* () {
      let output = "";
      for await (const chunk of mockStream(options.messages)) {
        output += chunk;
        yield chunk;
      }
      resolveUsage({
        tokensIn: options.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0),
        tokensOut: estimateTokens(output),
        provider: "mock",
        model,
      });
    })();
    return { stream, usage };
  }

  let latestUsage: StreamUsage | null = null;
  const stream = (async function* () {
    let output = "";
    try {
      for await (const chunk of openAiCompatibleStream(provider, model, options.messages, options, (u) => {
        latestUsage = u;
      })) {
        output += chunk;
        yield chunk;
      }
    } finally {
      resolveUsage(
        latestUsage ?? {
          tokensIn: options.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0),
          tokensOut: estimateTokens(output),
          provider: provider.id,
          model,
        },
      );
    }
  })();

  return { stream, usage };
}

/** Versi non-streaming (dipakai untuk operasi singkat seperti generate pertanyaan/judul). */
export async function completeChat(options: StreamOptions): Promise<{ text: string; usage: StreamUsage }> {
  const { stream, usage } = streamChat(options);
  let text = "";
  for await (const chunk of stream) text += chunk;
  return { text, usage: await usage };
}
