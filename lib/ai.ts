/**
 * Router AI multi-provider.
 *
 * Semua provider yang dipakai berbicara protokol OpenAI-compatible
 * (`POST {baseUrl}/chat/completions` dengan `stream: true`), jadi menambah
 * provider baru cukup menambah entri di `lib/env.ts`.
 *
 * Provider `mock` dipakai kalau tidak ada API key sama sekali: ia menghasilkan
 * respons PRD yang wajar (deterministik, tanpa jaringan) supaya aplikasi bisa
 * dicoba dan dites end-to-end tanpa kredensial.
 */
import { findProvider, parseModelId, aiIdleTimeoutMs, type ProviderConfig } from "./env.ts";
import { estimateTokens } from "./plans.ts";

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

/**
 * Error khusus saat provider berhenti mengirim data tanpa menutup koneksi.
 * Dibedakan dari ModelError biasa supaya route bisa menyelamatkan teks yang
 * sudah diterima (parsial) daripada membuang semuanya.
 */
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

/**
 * Ambil isi pesan user yang bersih: buang delimiter anti-injection
 * (`<pesan_user>`, catatan penutup) dan prefix instruksi internal, supaya
 * mock tidak pernah menampilkan pembungkus internal ke pengguna.
 */
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

/** Mock: jawaban PRD realistis tanpa jaringan, dipakai untuk demo & test. */
async function* mockStream(messages: ChatMessage[]): AsyncIterable<string> {
  const userMessages = messages.filter((m) => m.role === "user");
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const isGenerate = messages.some((m) => m.role === "system" && m.content.includes("MODE: GENERATE_PRD"));
  const userTurns = userMessages.length;
  // Saat generate, judul & konteks diambil dari ide pertama; saat chat, dari pesan terakhir.
  const sourceMessage = isGenerate ? (userMessages[0]?.content ?? lastUser) : lastUser;
  const cleaned = cleanUserContent(sourceMessage);
  const idea = cleaned.slice(0, 400);

  // Judul diambil dari ide supaya judul project hasil deriveTitleFromPrd masuk akal.
  const firstSentence = cleaned.split(/(?<=[.!?])\s/)[0] ?? cleaned;
  const shortIdea = (firstSentence.length >= 12 ? firstSentence : cleaned).slice(0, 60).trim() || "Produk Baru";

  const reply = isGenerate
    ? [
        `# PRD: ${shortIdea}`,
        "",
        "> Dihasilkan oleh provider **mock** (mode demo tanpa API key). Isi `.env.local` dengan API key provider asli untuk hasil sungguhan.",
        "",
        "## Ringkasan Produk",
        `Produk ini dibangun dari ide berikut: "${idea || "(ide belum diisi)"}".`,
        "Tujuannya menyelesaikan masalah utama pengguna dengan alur sederhana yang bisa dipakai tanpa pelatihan.",
        "",
        "## Latar Belakang & Masalah",
        "- Proses manual yang dipakai sekarang lambat dan mudah salah catat.",
        "- Data penting tersebar sehingga sulit dipantau saat dibutuhkan.",
        "- Solusi yang ada terlalu rumit untuk pengguna dengan perangkat terbatas.",
        "",
        "## Tujuan",
        "- Tujuan bisnis: memvalidasi permintaan pasar dengan rilis cepat.",
        "- Tujuan produk: pengguna mencapai nilai utama kurang dari 10 menit setelah sign up.",
        "",
        "## Target Pengguna",
        "| Persona | Kebutuhan |",
        "|---|---|",
        "| Pengguna awal | Alur cepat, tanpa setup rumit |",
        "| Pengguna lanjutan | Kontrol, integrasi, dan export data |",
        "",
        "## Ruang Lingkup (In/Out of Scope)",
        "- In scope: autentikasi, alur inti, riwayat data, export.",
        "- Out of scope: integrasi pembayaran otomatis, aplikasi native terpisah, marketplace.",
        "",
        "## Fitur Utama",
        "1. **Onboarding & autentikasi** — daftar/masuk dengan email, sesi aman, alur singkat menuju fitur inti.",
        "2. **Alur inti produk (happy path)** — pengguna menyelesaikan aksi utama dalam maksimal 3 langkah.",
        "3. **Riwayat & pengaturan akun** — daftar aktivitas terbaru, ubah profil, kelola preferensi.",
        "4. **Export data** — unduh data dalam format markdown/JSON.",
        "",
        "## User Flow",
        "1. Buka landing page dan paham value proposition.",
        "2. Sign up lalu langsung diarahkan ke alur inti.",
        "3. Selesaikan aksi utama dan dapat hasil.",
        "4. Simpan atau export hasil.",
        "",
        "## Kebutuhan Non-Fungsional",
        "- Performa: halaman utama tampil di bawah 2 detik pada koneksi 4G.",
        "- Keamanan: data pengguna terenkripsi at-rest, akses hanya untuk pemiliknya.",
        "- Skalabilitas: API layer stateless supaya bisa di-scale horizontal.",
        "",
        "## Tech Stack",
        "- Frontend: Next.js + Tailwind CSS, mobile-first.",
        "- Backend: API routes stateless + database relasional.",
        "- Infrastruktur: hosting aplikasi + managed database, monitoring dasar.",
        "",
        "## Kriteria Selesai (Acceptance Criteria)",
        "- [ ] Pengguna baru bisa menyelesaikan alur inti tanpa bantuan.",
        "- [ ] Data pengguna hanya bisa diakses pemiliknya.",
        "- [ ] Halaman utama memuat < 2 detik pada koneksi 4G.",
        "",
        "## Task Breakdown untuk AI Coding Agent",
        "- [ ] T1 — Setup project, linting, dan struktur folder | file: package.json | depends: none | kompleksitas: S",
        "- [ ] T2 — Skema database & migrasi awal | file: db/schema.sql | depends: T1 | kompleksitas: M",
        "- [ ] T3 — Endpoint autentikasi (register, login, logout, me) | file: app/api/auth/ | depends: T2 | kompleksitas: M",
        "- [ ] T4 — Halaman login & register | file: app/login/page.tsx | depends: T3 | kompleksitas: S",
        "- [ ] T5 — Model data & lapisan akses data | file: lib/repo.ts | depends: T2 | kompleksitas: M",
        "- [ ] T6 — API resource utama (list, detail, create, update, delete) | file: app/api/items/ | depends: T5 | kompleksitas: M",
        "- [ ] T7 — Halaman daftar data dengan filter & pencarian | file: app/dashboard/page.tsx | depends: T6 | kompleksitas: M",
        "- [ ] T8 — Halaman detail & form edit | file: app/dashboard/[id]/page.tsx | depends: T7 | kompleksitas: L",
        "- [ ] T9 — Komponen UI dasar (tombol, input, kartu, toast) | file: components/ui/ | depends: T1 | kompleksitas: M",
        "- [ ] T10 — Alur onboarding singkat | file: components/Onboarding.tsx | depends: T4, T7 | kompleksitas: S",
        "- [ ] T11 — Export markdown & JSON | file: app/api/items/[id]/export/route.ts | depends: T6 | kompleksitas: S",
        "- [ ] T12 — Rate limiting & validasi input | file: lib/rate-limit.ts | depends: T6 | kompleksitas: M",
        "- [ ] T13 — Telemetry dasar & pencatatan error | file: lib/telemetry.ts | depends: T1 | kompleksitas: S",
        "- [ ] T14 — Pengujian alur inti end-to-end | file: scripts/smoke.mjs | depends: T8, T11 | kompleksitas: M",
        "",
        "## Pertanyaan Terbuka",
        "- Metrik keberhasilan utama apa yang dipantau di minggu pertama?",
        "- Apakah perlu mode offline?",
      ].join("\n")
    : userTurns >= 2
      ? [
          "Terima kasih, informasinya sudah cukup jelas buat saya:",
          "",
          `- Masalah & target pengguna: ${idea || "(dari percakapan)"}`,
          "- Fitur inti dan batasan sudah disebutkan.",
          "",
          "Saya siap menyusun PRD lengkap beserta task breakdown-nya. Klik tombol **Generate PRD** di bawah panel ini.",
          "",
          "[[SIAP_PRD]]",
        ].join("\n")
      : [
          "Saya bantu susun PRD-nya. Biar hasilnya pas, saya perlu tahu beberapa hal dulu:",
          "",
          `1. Dari ide "${idea || "(ide kamu)"}", siapa pengguna utama yang paling ingin dibantu?`,
          "2. Fitur apa yang **wajib ada** di versi pertama (maksimal 3)?",
          "3. Batasan apa yang perlu saya perhatikan (waktu rilis, budget, atau platform)?",
          "",
          "_Catatan: ini mode demo (provider mock). Isi API key di `.env.local` untuk memakai model AI asli._",
        ].join("\n");

  // Streaming bertahap supaya UI tetap menguji jalur streaming sungguhan.
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
  // Watchdog diam: kalau provider berhenti mengirim data di tengah stream,
  // batalkan request supaya route bisa menyelamatkan teks parsial alih-alih
  // menunggu timeout bawaan fetch (300 detik) lalu membuang semuanya.
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
  const collected: string[] = [];

  const reader = res.body.getReader();
  try {
    while (true) {
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await reader.read();
      } catch (error) {
        // Abort dari watchdog ≠ error jaringan biasa: tandai supaya route tahu
        // teks yang sudah diterima masih layak disimpan.
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
          if (delta) {
            collected.push(delta);
            yield delta;
          }
          if (json.usage) {
            onUsage({
              tokensIn: json.usage.prompt_tokens ?? 0,
              tokensOut: json.usage.completion_tokens ?? 0,
              provider: provider.id,
              model,
            });
          }
        } catch {
          // Chunk tidak lengkap / bukan JSON — abaikan, lanjut ke baris berikutnya.
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
        // Sebagian provider (mis. Gemini) mengirim usage kumulatif di setiap
        // chunk, jadi simpan snapshot terakhir dan pakai saat stream selesai.
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

/** Versi non-streaming (dipakai untuk operasi singkat seperti generate judul). */
export async function completeChat(options: StreamOptions): Promise<{ text: string; usage: StreamUsage }> {
  const { stream, usage } = streamChat(options);
  let text = "";
  for await (const chunk of stream) text += chunk;
  return { text, usage: await usage };
}
