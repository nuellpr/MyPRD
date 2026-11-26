export interface ClarifyingQuestion {
  id: string;
  question: string;
  type: "text" | "single" | "multi";
  options?: string[];
}

export interface WizardAnswer {
  questionId: string;
  text?: string;
  selected?: string[];
  skipped?: boolean;
}

export function questionsSystemPrompt(language: "id" | "en"): string {
  const lang = language === "en" ? "English" : "Bahasa Indonesia";
  return [
    "MODE: GENERATE_QUESTIONS",
    `Kamu adalah product manager senior. Balas HANYA dengan JSON array valid berisi tepat 5 pertanyaan klarifikasi berbahasa ${lang} untuk ide aplikasi user.`,
    "",
    "ATURAN OUTPUT:",
    "- Output HANYA JSON array (tanpa markdown, tanpa pembuka/penutup).",
    '- Format tiap item: {"id":"q1","question":"...","type":"text"|"single"|"multi","options":["..."]}',
    "- Q1 (id: q1): type 'text' — tanyakan siapa pengguna utamanya dan bagaimana cara dia melakukannya sekarang (tanpa options).",
    "- Q2 (id: q2): type 'single' — tanyakan 1 aksi pertama paling penting saat user membuka aplikasi (4-5 options spesifik domain).",
    "- Q3 (id: q3): type 'multi' — tanyakan 3 fitur wajib di versi awal (6 options fitur inti spesifik domain).",
    "- Q4 (id: q4): type 'single' — tanyakan keunggulan utama aplikasi dibanding cara lama (4 options).",
    "- Q5 (id: q5): type 'multi' — tanyakan kebutuhan operasional/retensi agar user balik lagi (4-5 options).",
    "- Gunakan bahasa sehari-hari yang mudah dipahami, bukan istilah teknis berat.",
  ].join("\n");
}

/** Buat 5 pertanyaan kontekstual deterministik berdasarkan kata kunci ide (juga dipakai provider mock & fallback). */
export function buildFallbackQuestions(idea: string, language: "id" | "en" = "id"): ClarifyingQuestion[] {
  const lower = idea.toLowerCase();
  const isEn = language === "en";

  if (/(toko|online|ecommerce|e-commerce|belanja|produk|checkout|katalog|jualan)/.test(lower)) {
    return isEn
      ? [
          {
            id: "q1",
            question: "Tell us about one person who needs this online store app. How do they currently sell or buy items?",
            type: "text",
          },
          {
            id: "q2",
            question: "When opening the app for the first time, what is the single action a visitor must be able to do right away?",
            type: "single",
            options: ["Browse product catalog", "Buy one item immediately", "Add store products", "Create account first", "Chat with seller"],
          },
          {
            id: "q3",
            question: "Which 3 core features must be ready in the first version? (choose one or more)",
            type: "multi",
            options: ["Product list with photos", "Shopping cart", "Online payment / QRIS", "Track delivery", "Buyer-seller chat", "Order history"],
          },
          {
            id: "q4",
            question: "What makes your online store easier to use compared to existing marketplaces/chat?",
            type: "single",
            options: ["Simpler checkout flow", "Faster order processing", "Own customer data", "Lower operational cost"],
          },
          {
            id: "q5",
            question: "What brings buyers or staff back to open this app regularly?",
            type: "multi",
            options: ["Easy order tracking", "Promos & vouchers", "Real-time stock alerts", "Sales recap dashboard"],
          },
        ]
      : [
          {
            id: "q1",
            question: "Ceritakan satu orang yang butuh aplikasi toko online ini. Sekarang dia ngapain buat jualan atau beli barangnya?",
            type: "text",
          },
          {
            id: "q2",
            question: "Waktu pertama kali buka aplikasimu, satu hal apa yang harus langsung bisa dia lakukan biar nggak langsung nutup?",
            type: "single",
            options: ["Lihat daftar barang", "Beli satu barang", "Pasang barang jualan", "Bikin akun dulu", "Chat penjual"],
          },
          {
            id: "q3",
            question: "Dari fitur-fitur ini, mana 3 yang paling wajib ada di aplikasi kamu? (boleh pilih beberapa)",
            type: "multi",
            options: ["Daftar barang dengan foto", "Keranjang belanja", "Bayar online / QRIS", "Lacak pengiriman", "Chat pembeli-penjual", "Riwayat pesanan"],
          },
          {
            id: "q4",
            question: "Menurutmu, apa yang bikin aplikasimu lebih enak dipakai dibanding cara orang jualan/beli sekarang?",
            type: "single",
            options: ["Lebih gampang dipakai", "Lebih cepat belanja", "Data pelanggan milik sendiri", "Bisa pantau pesanan rapi"],
          },
          {
            id: "q5",
            question: "Apa yang bikin orang bakal balik lagi buka aplikasi ini, bukan cuma sekali doang?",
            type: "multi",
            options: ["Gampang lacak pesanan", "Promo dan diskon", "Notifikasi status otomatis", "Rekap penjualan harian"],
          },
        ];
  }

  if (/(kasir|pos|warung|kopi|kafe|restoran|resto|penjualan)/.test(lower)) {
    return [
      {
        id: "q1",
        question: "Siapa kasir atau pemilik usaha yang pakai aplikasi ini sehari-hari, dan sekarang nyatat transaksinya pakai apa?",
        type: "text",
      },
      {
        id: "q2",
        question: "Saat aplikasi dibuka saat jam ramai, aksi apa yang harus selesai paling cepat?",
        type: "single",
        options: ["Catat pesanan & bayar", "Cek stok bahan", "Lihat omzet hari ini", "Scan QRIS pelanggan"],
      },
      {
        id: "q3",
        question: "Dari fitur kasir ini, mana 3 yang paling wajib ada di versi pertama?",
        type: "multi",
        options: ["Input pesanan cepat", "Pembayaran tunai & QRIS", "Cetak / kirim struk WA", "Rekap omzet harian", "Kelola stok menu", "Multi kasir / shift"],
      },
      {
        id: "q4",
        question: "Apa keunggulan utama yang paling dirasakan dibanding catat manual atau POS lain?",
        type: "single",
        options: ["Ringan di HP Android murah", "Tanpa pelatihan rumit", "Laporan laba otomatis", "Bisa dipakai offline dulu"],
      },
      {
        id: "q5",
        question: "Hal apa yang bikin pemilik usaha terus membuka aplikasi ini setiap hari?",
        type: "multi",
        options: ["Ringkasan tutup kasir", "Peringatan stok menipis", "Daftar menu terlaris", "Export laporan bulanan"],
      },
    ];
  }

  if (/(booking|reservasi|jadwal|antrian|barber|salon|futsal|klinik)/.test(lower)) {
    return [
      {
        id: "q1",
        question: "Ceritakan satu pelanggan atau admin yang butuh aplikasi booking ini. Sekarang cara atur jadwalnya gimana?",
        type: "text",
      },
      {
        id: "q2",
        question: "Waktu pelanggan buka aplikasimu pertama kali, hal apa yang harus langsung terlihat?",
        type: "single",
        options: ["Slot jam yang kosong", "Daftar layanan & harga", "Pilih kapster / petugas", "Lokasi & jam buka"],
      },
      {
        id: "q3",
        question: "Dari fitur-fitur ini, mana 3 yang paling wajib ada di versi pertama?",
        type: "multi",
        options: ["Pilih tanggal & jam slot", "Pilih petugas / ruangan", "Notifikasi pengingat WA", "Bayar DP / QRIS", "Kelola jadwal admin", "Riwayat booking pelanggan"],
      },
      {
        id: "q4",
        question: "Kenapa pelanggan lebih memilih booking lewat aplikasi ini daripada chat manual?",
        type: "single",
        options: ["Langsung tahu slot kosong", "Nggak perlu tunggu balasan admin", "Ada pengingat otomatis", "Bisa reschedule gampang"],
      },
      {
        id: "q5",
        question: "Apa yang membuat pelanggan dan pemilik tempat balik lagi pakai aplikasi ini?",
        type: "multi",
        options: ["Poin loyalitas / promo", "Booking ulang 1 klik", "Rekap omzet & komisi", "Rating & ulasan"],
      },
    ];
  }

  if (/(uang|keuangan|expense|pengeluaran|tabungan|budget|finance|utang|piutang)/.test(lower)) {
    return [
      {
        id: "q1",
        question: "Siapa pengguna utama pencatat keuangan ini, dan selama ini mencatatnya pakai cara apa?",
        type: "text",
      },
      {
        id: "q2",
        question: "Saat baru buka aplikasi, satu aksi apa yang harus bisa beres dalam 5 detik?",
        type: "single",
        options: ["Catat pengeluaran baru", "Lihat sisa budget bulan ini", "Cek target tabungan", "Catat pemasukan"],
      },
      {
        id: "q3",
        question: "Dari fitur keuangan ini, mana 3 yang paling wajib ada di versi awal?",
        type: "multi",
        options: ["Catat transaksi cepat", "Kategori otomatis", "Grafik pengeluaran bulanan", "Target tabungan", "Pengingat tagihan", "Export CSV / laporan"],
      },
      {
        id: "q4",
        question: "Apa yang bikin aplikasi ini lebih nyaman dipakai tiap hari dibanding spreadsheet atau aplikasi lain?",
        type: "single",
        options: ["Input super cepat", "Tampilan simpel & jelas", "Pengingat batas boros", "Bisa multi-dompet"],
      },
      {
        id: "q5",
        question: "Insight atau fitur apa yang bikin user rutin buka aplikasimu setiap minggu?",
        type: "multi",
        options: ["Ringkasan mingguan", "Progres target tabungan", "Alert mendekati limit", "Perbandingan bulan lalu"],
      },
    ];
  }

  return isEn
    ? [
        {
          id: "q1",
          question: "Describe one real person who needs this app. How do they solve this problem today?",
          type: "text",
        },
        {
          id: "q2",
          question: "When a user opens the app for the first time, what single action should they succeed at immediately?",
          type: "single",
          options: ["Complete the main workflow", "Explore sample data", "Create & save first item", "Sign up in seconds"],
        },
        {
          id: "q3",
          question: "Which 3 core features are strictly required for v1?",
          type: "multi",
          options: ["Clean dashboard overview", "Create & manage items", "Search & filters", "Notifications / reminders", "Role & account management", "Export report"],
        },
        {
          id: "q4",
          question: "What is the biggest improvement over their current workflow?",
          type: "single",
          options: ["Much faster to complete", "Fewer manual mistakes", "Everything tracked in one place", "Easier on mobile"],
        },
        {
          id: "q5",
          question: "What keeps users coming back to this app every week?",
          type: "multi",
          options: ["Progress & analytics", "Real-time status updates", "Saved history & templates", "Team collaboration"],
        },
      ]
    : [
        {
          id: "q1",
          question: "Ceritakan satu orang yang paling butuh aplikasi ini. Sekarang dia menyelesaikan masalahnya pakai cara apa?",
          type: "text",
        },
        {
          id: "q2",
          question: "Saat pertama kali buka aplikasi, satu aksi apa yang harus langsung bisa dilakukan biar nggak bingung?",
          type: "single",
          options: ["Langsung coba fitur utama", "Buat data / entri pertama", "Lihat ringkasan dashboard", "Daftar akun cepat"],
        },
        {
          id: "q3",
          question: "Dari fitur-fitur ini, mana 3 yang paling wajib ada di versi pertama?",
          type: "multi",
          options: ["Dashboard ringkasan", "Tambah, ubah, & kelola data", "Pencarian & filter cepat", "Notifikasi / pengingat", "Manajemen akun & peran", "Export laporan"],
        },
        {
          id: "q4",
          question: "Apa nilai lebih utama aplikasi ini dibanding cara kerja yang dipakai sekarang?",
          type: "single",
          options: ["Proses jauh lebih cepat", "Minim salah catat", "Semua data rapi di satu tempat", "Nyaman dipakai di HP"],
        },
        {
          id: "q5",
          question: "Apa yang membuat pengguna terus balik memakai aplikasi ini setiap minggu?",
          type: "multi",
          options: ["Progress & statistik jelas", "Status update real-time", "Riwayat tersimpan rapi", "Kolaborasi dengan tim"],
        },
      ];
}

export function parseQuestionsJson(raw: string, idea: string, language: "id" | "en" = "id"): ClarifyingQuestion[] {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
  try {
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
    const parsed = JSON.parse(slice) as unknown;
    if (!Array.isArray(parsed)) return buildFallbackQuestions(idea, language);
    const items: ClarifyingQuestion[] = [];
    for (let i = 0; i < parsed.length && items.length < 5; i++) {
      const row = parsed[i] as Record<string, unknown>;
      const q = typeof row?.question === "string" ? row.question.trim() : "";
      if (!q) continue;
      const t = row?.type === "text" || row?.type === "single" || row?.type === "multi" ? row.type : i === 0 ? "text" : "single";
      const opts = Array.isArray(row?.options)
        ? row.options.filter((o): o is string => typeof o === "string" && o.trim().length > 0).map((o) => o.trim()).slice(0, 7)
        : undefined;
      if (t !== "text" && (!opts || opts.length < 2)) continue;
      items.push({
        id: typeof row?.id === "string" && row.id.trim() ? row.id.trim() : `q${items.length + 1}`,
        question: q,
        type: t,
        options: t === "text" ? undefined : opts,
      });
    }
    return items.length >= 3 ? items : buildFallbackQuestions(idea, language);
  } catch {
    return buildFallbackQuestions(idea, language);
  }
}

export function formatWizardSummary(input: {
  techMode: "ai" | "custom";
  selectedStack: string[];
  customStack: string;
  referenceNote: string;
  questions: ClarifyingQuestion[];
  answers: Record<string, WizardAnswer>;
}): string {
  const lines: string[] = [];
  if (input.techMode === "ai") {
    lines.push("Preferensi teknologi: Biarkan AI memilihkan tech stack terbaik dan paling praktis.");
  } else {
    const allStack = [...input.selectedStack, input.customStack.trim()].filter(Boolean);
    lines.push(`Preferensi teknologi pilihan user: ${allStack.length ? allStack.join(", ") : "Standard modern web stack"}`);
  }
  if (input.referenceNote.trim()) {
    lines.push(`Referensi tambahan: ${input.referenceNote.trim()}`);
  }
  lines.push("");
  lines.push("Jawaban klarifikasi user:");
  for (const q of input.questions) {
    const ans = input.answers[q.id];
    if (!ans || ans.skipped) {
      lines.push(`- ${q.question} -> (dilewati user)`);
      continue;
    }
    const parts: string[] = [];
    if (ans.selected?.length) parts.push(ans.selected.join(", "));
    if (ans.text?.trim()) parts.push(ans.text.trim());
    lines.push(`- ${q.question} -> ${parts.length ? parts.join(" | ") : "(dilewati user)"}`);
  }
  return lines.join("\n");
}
