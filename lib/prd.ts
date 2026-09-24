/**
 * System prompt & helper untuk alur "ngobrol → PRD".
 *
 * PRD yang dihasilkan harus cukup detail supaya AI coding agent (Claude Code,
 * Cursor, OpenCode, dll) bisa langsung eksekusi. Karena itu strukturnya dibuat
 * baku dan selalu diakhiri bagian kriteria selesai + task breakdown.
 */
import type { ChatMessage } from "./ai.ts";

export const PRD_SECTIONS = [
  "Ringkasan Produk",
  "Latar Belakang & Masalah",
  "Tujuan",
  "Target Pengguna",
  "Ruang Lingkup (In/Out of Scope)",
  "Fitur Utama",
  "User Flow",
  "Kebutuhan Non-Fungsional",
  "Tech Stack",
  "Kriteria Selesai (Acceptance Criteria)",
  "Task Breakdown untuk AI Coding Agent",
  "Pertanyaan Terbuka",
] as const;

export type Language = "id" | "en";

export function languageName(language: Language): string {
  return language === "en" ? "English" : "Bahasa Indonesia";
}

/** System prompt mode chat: AI bertanya dulu, tidak langsung menebak. */
export function chatSystemPrompt(language: Language): string {
  return [
    "Kamu adalah product manager senior yang membantu developer Indonesia menyusun PRD siap eksekusi untuk AI coding agent.",
    `Selalu balas dalam ${languageName(language)}.`,
    "",
    "ATURAN PENTING:",
    "1. JANGAN langsung menulis PRD lengkap saat informasi masih kurang.",
    "2. Ajukan maksimal 3 pertanyaan klarifikasi per balasan, singkat dan spesifik (target user, fitur wajib, batasan teknis/waktu, kriteria sukses).",
    "3. Kalau jawaban user sudah cukup (minimal: masalah, target user, 2-3 fitur inti, batasan), akhiri balasan dengan baris tepat: [[SIAP_PRD]]",
    "4. Jangan mengarang detail teknis yang tidak disebutkan user — tanyakan.",
    "5. Bahasa santai tapi profesional, tanpa basa-basi panjang.",
    "6. Setelah user menjawab pertanyaanmu minimal sekali, anggap informasi sudah cukup: ringkas pemahamanmu lalu akhiri dengan baris [[SIAP_PRD]]. Jangan bertanya lebih dari dua putaran.",
    "",
    "Format balasan saat bertanya: ringkas 1 kalimat pemahamanmu, lalu daftar bernomor pertanyaan.",
  ].join("\n");
}

/** System prompt mode generate: menghasilkan PRD final dari percakapan. */
export function generateSystemPrompt(language: Language): string {
  return [
    "MODE: GENERATE_PRD",
    "Kamu adalah technical writer produk. Ubah percakapan berikut menjadi PRD final berbahasa " + languageName(language) + ".",
    "",
    "SYARAT OUTPUT:",
    "- Output HANYA markdown PRD, tanpa pembuka/penutup, tanpa code fence pembungkus.",
    "- Mulai dengan heading H1 berisi judul produk: `# PRD: <judul singkat produk>`.",
    `- Gunakan tepat bagian berikut, dengan heading level 2: ${PRD_SECTIONS.map((s) => `## ${s}`).join(" | ")}`,
    "- Bagian 'Fitur Utama': setiap fitur punya deskripsi, alur singkat, dan kriteria selesai yang bisa diverifikasi (bullet list).",
    "- Bagian 'Task Breakdown untuk AI Coding Agent': daftar task granular dalam format:",
    "  `- [ ] T1 — <judul task> | file: <path yang disarankan> | depends: <T0/none> | kompleksitas: S/M/L`",
    "  Sertakan 8-20 task yang urut secara dependensi dan cukup detail untuk ditempel ke Claude Code/Cursor.",
    "- Bagian 'Kriteria Selesai': checklist `- [ ]` yang terukur.",
    "- Kalau ada informasi yang tidak diketahui, tulis di 'Pertanyaan Terbuka', jangan dikarang.",
    "- Tulis requirement teknis eksplisit (endpoint, tabel data, komponen UI) bila sudah disebut user.",
  ].join("\n");
}

export interface BuildMessagesInput {
  language: Language;
  history: ChatMessage[];
  idea?: string;
  mode: "chat" | "generate";
}

export function buildMessages({ language, history, idea, mode }: BuildMessagesInput): ChatMessage[] {
  const system = mode === "generate" ? generateSystemPrompt(language) : chatSystemPrompt(language);
  const messages: ChatMessage[] = [{ role: "system", content: system }];
  if (idea) {
    // Ide asli selalu jadi konteks pertama supaya judul & isi PRD tidak bergeser
    // ke topik jawaban klarifikasi terakhir.
    messages.push({
      role: "user",
      content: mode === "generate" ? `Ide produk awal dari user: ${idea}` : `Ide produk saya: ${idea}`,
    });
  }
  for (const m of history) {
    if (m.role === "system") continue;
    messages.push(m);
  }
  if (mode === "generate") {
    // Sebagian provider (mis. Gemini) menolak request yang berakhir dengan
    // giliran model: "Requests ending with a model turn are not supported".
    // Karena itu percakapan selalu ditutup instruksi user yang eksplisit.
    messages.push({
      role: "user",
      content:
        "Susun PRD final sekarang berdasarkan ide dan percakapan di atas. Keluarkan hanya markdown PRD sesuai format, tanpa kalimat pembuka atau penutup.",
    });
  }
  return messages;
}

/** Deteksi penanda dari model bahwa informasi sudah cukup untuk menyusun PRD. */
export function isReadyForPrd(text: string): boolean {
  return text.includes("[[SIAP_PRD]]");
}

export function stripMarkers(text: string): string {
  return text.replace(/\[\[SIAP_PRD\]\]/g, "").trim();
}

/**
 * Filter streaming untuk marker internal: menahan ekor teks yang mungkin
 * bagian dari `[[SIAP_PRD]]` supaya marker tidak pernah sampai ke klien,
 * termasuk saat terbagi antar chunk (`[[SIAP` + `_PRD]]`).
 *
 * Pakai `push()` untuk setiap delta lalu `flush()` di akhir stream.
 */
export function createMarkerFilter(marker = "[[SIAP_PRD]]") {
  let pending = "";
  const maxHold = marker.length - 1;

  return {
    push(chunk: string): string {
      const combined = (pending + chunk).replaceAll(marker, "");
      let hold = 0;
      const limit = Math.min(maxHold, combined.length);
      for (let len = limit; len > 0; len -= 1) {
        if (marker.startsWith(combined.slice(-len))) {
          hold = len;
          break;
        }
      }
      pending = hold > 0 ? combined.slice(-hold) : "";
      return hold > 0 ? combined.slice(0, -hold) : combined;
    },
    flush(): string {
      const rest = pending.replaceAll(marker, "");
      pending = "";
      return rest;
    },
  };
}

/** Bersihkan output PRD dari pembungkus code fence yang kadang ikut terkirim. */
export function cleanPrdMarkdown(text: string): string {
  let out = text.trim();
  const fence = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/;
  const match = out.match(fence);
  if (match) out = match[1].trim();
  return out;
}

/** Potong judul di batas kata supaya tidak terputus di tengah kata. */
function truncateTitle(text: string, max = 80): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).trim();
}

/** Hitung judul otomatis dari PRD (untuk nama project). */
export function deriveTitleFromPrd(markdown: string, fallback: string): string {
  const h1 = markdown.match(/^#\s+(.+)$/m);
  if (h1) return truncateTitle(h1[1].replace(/^PRD[:\-\s]*/i, "")) || fallback;
  // Tanpa H1: pakai kalimat pertama dari Ringkasan Produk supaya judul tidak
  // terpotong di tengah kalimat.
  const summary = markdown.match(/^##\s+1?\.?\s*Ringkasan Produk\s*\n+([^\n#]+)/m);
  if (summary) {
    const firstLine = summary[1].trim();
    const sentence = firstLine.split(/(?<=[.!?])\s/)[0] ?? firstLine;
    const title = sentence.length >= 12 ? sentence : firstLine;
    return truncateTitle(title) || fallback;
  }
  return truncateTitle(fallback) || "PRD tanpa judul";
}

/** Cek apakah markdown punya struktur PRD minimal. */
export function looksLikePrd(markdown: string): boolean {
  const headings = markdown.match(/^##\s+/gm)?.length ?? 0;
  return headings >= 3 && /Kriteria Selesai|Acceptance Criteria/i.test(markdown);
}
