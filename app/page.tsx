import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { PricingCards } from "@/components/PricingCards";
import { currentUser } from "@/lib/auth";

const STEPS = [
  {
    title: "1. Ceritakan idemu",
    body: "Tulis ide dalam bahasa sehari-hari. Tidak perlu format khusus, tidak perlu istilah teknis.",
  },
  {
    title: "2. Jawab pertanyaan AI",
    body: "AI bertanya soal target user, fitur wajib, dan batasan. Jadi PRD-nya tidak menebak-nebak.",
  },
  {
    title: "3. Review & export",
    body: "Edit PRD di editor markdown, lalu export .md (atau .pdf untuk paket Starter/Pro) — plus task breakdown siap tempel ke Claude Code/Cursor.",
  },
];

const FEATURES = [
  {
    title: "PRD terstruktur, bukan teks panjang",
    body: "12 bagian baku: ringkasan, tujuan, target pengguna, ruang lingkup, fitur utama, user flow, kebutuhan non-fungsional, tech stack, kriteria selesai, task breakdown, pertanyaan terbuka.",
  },
  {
    title: "Task breakdown untuk AI coding agent",
    body: "Setiap task punya file yang disarankan, dependency, dan estimasi kompleksitas. Export sebagai markdown checklist atau JSON.",
  },
  {
    title: "Template & starter kit",
    body: "Salin prompt install template (Next.js / TanStack + PostgreSQL + Docker) ke Claude Code, Cursor, atau OpenCode — scaffold codebase production-ready tanpa mengetik perintah.",
    href: "/templates",
  },
  {
    title: "Pilih model AI-mu",
    body: "Pakai OpenAI, OpenRouter, DeepSeek, Kimi, Qwen, atau Groq — cukup isi API key di server, user tinggal pilih modelnya.",
  },
  {
    title: "Data PRD terenkripsi",
    body: "Ide bisnis itu sensitif. Isi chat dan PRD disimpan terenkripsi (AES-256-GCM) di database.",
  },
  {
    title: "Output Bahasa Indonesia",
    body: "Default Bahasa Indonesia, dengan opsi output English kalau kamu kerja untuk klien luar.",
  },
  {
    title: "Kuota & biaya terkendali",
    body: "Kuota per bulan, rate limiting, dan pencatatan pemakaian token per model supaya biaya AI tidak bocor.",
  },
];

const FAQ = [
  {
    q: "Apakah saya butuh API key AI sendiri?",
    a: "Untuk mencoba, tidak. Ada mode demo bawaan (provider mock) yang membuat PRD contoh tanpa API key. Untuk hasil sungguhan, admin server mengisi API key provider di .env.local lalu user memilih modelnya.",
  },
  {
    q: "PRD-nya bisa langsung dipakai di Claude Code atau Cursor?",
    a: "Ya. Bagian Task Breakdown dibuat dengan format yang bisa langsung ditempel: id task, file yang disarankan, dependency, dan kompleksitas S/M/L.",
  },
  {
    q: "Apakah data ide saya aman?",
    a: "Isi percakapan dan PRD disimpan terenkripsi di database, dan setiap project hanya bisa diakses pemiliknya (setiap query difilter by user).",
  },
  {
    q: "Bisa export ke PDF?",
    a: "Bisa. Paket Starter/Pro punya tombol .pdf yang mengunduh PRD sebagai dokumen PDF rapi. Paket Free bisa memakai tombol Cetak di browser.",
  },
];

export default async function HomePage() {
  const user = await currentUser();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader authed={Boolean(user)} />

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-slate-800/80">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[46rem] -translate-x-1/2 rounded-full bg-sky-500/20 blur-3xl"
          />
          <div className="mx-auto max-w-6xl px-4 py-20 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs text-slate-300">
              Untuk developer Indonesia · vibe coding tanpa hasil ngawur
            </span>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Dari ide ke <span className="text-sky-400">PRD siap eksekusi</span> dalam hitungan menit
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-slate-300 sm:text-lg">
              Ngobrol santai soal idemu, jawab beberapa pertanyaan, lalu dapat PRD lengkap + task breakdown yang bisa
              langsung ditempel ke Claude Code, Cursor, atau OpenCode.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={user ? "/dashboard" : "/register"}
                className="rounded-lg bg-sky-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
              >
                {user ? "Buka dashboard" : "Bikin PRD pertama (gratis)"}
              </Link>
              <a
                href="#cara-kerja"
                className="rounded-lg border border-slate-700 px-6 py-3 text-sm font-medium text-slate-200 transition hover:border-slate-500"
              >
                Lihat cara kerjanya
              </a>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Tanpa kartu kredit · Bisa dicoba tanpa API key (mode demo) · Export markdown & PDF
            </p>
          </div>
        </section>

        <section id="cara-kerja" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">Cara kerjanya</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-400">
            PRD yang bagus lahir dari pertanyaan yang tepat — bukan dari tebakan model.
          </p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.title} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
                <h3 className="font-semibold text-sky-300">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="fitur" className="border-y border-slate-800/80 bg-slate-900/20">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-center text-2xl font-semibold sm:text-3xl">Yang kamu dapat</h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{feature.body}</p>
                  {"href" in feature && typeof feature.href === "string" ? (
                    <Link href={feature.href} className="mt-3 inline-block text-sm text-sky-400 hover:underline">
                      Lihat template →
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="harga" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">Harga</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-400">
            Mulai gratis. Upgrade kalau kuota generate-nya sudah terasa kurang.
          </p>
          <div className="mt-10">
            <PricingCards highlight="free" />
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">
            Pembayaran lokal via Midtrans (QRIS, e-wallet, transfer bank) — klik paket berbayar untuk checkout.
          </p>
        </section>

        <section id="faq" className="border-t border-slate-800/80 bg-slate-900/20">
          <div className="mx-auto max-w-3xl px-4 py-16">
            <h2 className="text-center text-2xl font-semibold sm:text-3xl">FAQ</h2>
            <div className="mt-8 space-y-4">
              {FAQ.map((item) => (
                <details key={item.q} className="group rounded-xl border border-slate-800 bg-slate-950/60 p-5">
                  <summary className="cursor-pointer list-none font-medium text-slate-100 marker:hidden">
                    <span className="mr-2 text-sky-400 group-open:hidden">+</span>
                    <span className="mr-2 hidden text-sky-400 group-open:inline">−</span>
                    {item.q}
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
