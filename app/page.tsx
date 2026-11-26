import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Faq } from "@/components/Faq";
import { Reveal, Stagger, StaggerItem, WordReveal } from "@/components/motion/Reveal";
import { PricingCards } from "@/components/PricingCards";
import { PromptComposer } from "@/components/PromptComposer";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { ShowcaseCards } from "@/components/home/ShowcaseCards";
import { StepsGrid } from "@/components/home/StepsGrid";
import { currentUser } from "@/lib/auth";
import { modelOptionsFor } from "@/lib/model-options";
import { getSiteStats } from "@/lib/repo";

export const dynamic = "force-dynamic";

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
    wide: true,
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
    wide: true,
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
  const stats = getSiteStats();
  const { initialModel } = modelOptionsFor(user);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader authed={Boolean(user)} stats={stats} />

      <main className="flex-1">
        {/* Hero Composer */}
        <section className="relative overflow-hidden border-b border-slate-800/80">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="orb orb-a" />
            <div className="orb orb-b" />
          </div>

          <div className="relative mx-auto max-w-6xl px-4 pt-14 pb-20 text-center sm:pt-20 sm:pb-24">
            <div className="mb-5 flex items-center justify-center gap-3">
              <Image
                src="/logo-mark.png"
                alt=""
                width={160}
                height={132}
                sizes="48px"
                priority
                className="float-y logo-glow h-10 w-auto rounded-xl"
              />
              <WordReveal
                as="h1"
                text="Mau bikin apa hari ini?"
                highlightWords={["apa"]}
                className="text-3xl font-bold tracking-tight text-white sm:text-5xl"
              />
            </div>

            <p className="hero-in mx-auto mb-8 max-w-xl text-sm text-slate-300 sm:text-base" style={{ animationDelay: "120ms" }}>
              Dari ide jadi PRD lengkap + task breakdown siap tempel ke Claude Code, Cursor, atau OpenCode.
            </p>

            <div className="hero-in" style={{ animationDelay: "180ms" }}>
              <Suspense fallback={<div className="mx-auto h-48 max-w-3xl rounded-2xl border border-slate-800 bg-[#0d1326]/70" />}>
                <PromptComposer authed={Boolean(user)} defaultModel={initialModel} variant="hero" />
              </Suspense>
            </div>

            <ShowcaseCards authed={Boolean(user)} />
          </div>
        </section>

        {/* Cara Kerja */}
        <section id="cara-kerja" className="mx-auto max-w-6xl px-4 py-16">
          <Reveal>
            <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">Cara kerjanya</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-400">
              PRD yang bagus lahir dari pertanyaan yang tepat — bukan dari tebakan model.
            </p>
          </Reveal>
          <StepsGrid steps={STEPS} />
        </section>

        {/* Fitur Bento Grid */}
        <section id="fitur" className="border-y border-slate-800/80 bg-[#070b17]/65">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <Reveal>
              <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">Yang kamu dapat</h2>
              <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-400">
                Semua yang dibutuhkan developer sebelum menulis baris kode pertama.
              </p>
            </Reveal>

            <Stagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <StaggerItem
                  key={feature.title}
                  className={`card-lift rounded-2xl border border-slate-800/90 bg-[#0b1020]/75 p-6 ${
                    feature.wide ? "lg:col-span-2" : ""
                  }`}
                >
                  <h3 className="font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{feature.body}</p>
                  {feature.href ? (
                    <Link href={feature.href} className="mt-3 inline-block text-sm text-[#35d6ff] hover:underline">
                      Lihat template →
                    </Link>
                  ) : null}
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        {/* Harga */}
        <section id="harga" className="mx-auto max-w-6xl px-4 py-16">
          <Reveal>
            <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">Harga</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-400">
              Mulai gratis. Upgrade kalau kuota generate-nya sudah terasa kurang.
            </p>
          </Reveal>
          <div className="mt-10">
            <PricingCards highlight="free" />
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">
            Pembayaran lokal via Midtrans / Mayar (QRIS, e-wallet, transfer bank) — klik paket berbayar untuk checkout.
          </p>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-slate-800/80 bg-[#070b17]/65">
          <div className="mx-auto max-w-3xl px-4 py-16">
            <Reveal>
              <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">FAQ</h2>
            </Reveal>
            <Faq items={FAQ} />
          </div>
        </section>

        {/* CTA Band */}
        <section className="mx-auto max-w-5xl px-4 py-16">
          <Reveal>
            <div className="glow-border rounded-3xl bg-[#0c1328]/85 p-8 text-center sm:p-12">
              <h2 className="text-2xl font-bold text-white sm:text-3xl">Siap ubah idemu jadi blueprint coding?</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300">
                Mulai gratis tanpa kartu kredit — coba langsung di mode demo atau hubungkan model AI favoritmu.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={user ? "/dashboard" : "/register"}
                  className="btn-shine rounded-full bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-[#35d6ff]/20 transition hover:brightness-110"
                >
                  {user ? "Buka dashboard" : "Daftar gratis"}
                </Link>
                <Link
                  href="/templates"
                  className="rounded-full border border-slate-700 px-6 py-3 text-sm font-medium text-slate-200 transition hover:border-[#35d6ff]/60 hover:text-white"
                >
                  Jelajahi template
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
