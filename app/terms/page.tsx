import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { currentUser } from "@/lib/auth";

export const metadata = {
  title: "Syarat & Ketentuan — MyPRD",
  description: "Syarat dan ketentuan penggunaan platform MyPRD, kuota paket, kepemilikan dokumen, dan langganan.",
};

export default async function TermsPage() {
  const user = await currentUser();
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader authed={Boolean(user)} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#35d6ff]">Legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Syarat &amp; Ketentuan</h1>
        <p className="mt-2 text-xs text-slate-400">Terakhir diperbarui: 27 November 2026</p>

        <div className="mt-8 space-y-6 rounded-2xl border border-slate-800/90 bg-[#0b1022]/80 p-6 text-sm leading-relaxed text-slate-300">
          <section>
            <h2 className="text-base font-semibold text-white">1. Penggunaan Layanan</h2>
            <p className="mt-2">
              MyPRD menyediakan alat bantu penyusunan Product Requirements Document (PRD), diagram arsitektur, roadmap,
              dan task breakdown berbasis AI. Kamu bertanggung jawab menjaga kerahasiaan akun serta tidak menyalahgunakan
              layanan untuk spam, eksploitasi sistem, atau aktivitas yang melanggar hukum.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">2. Kepemilikan Konten</h2>
            <p className="mt-2">
              Seluruh ide produk, PRD, diagram, dan task breakdown yang kamu hasilkan di MyPRD sepenuhnya menjadi milikmu
              dan bebas diekspor atau digunakan untuk proyek pribadi maupun komersial.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">3. Paket, Kuota &amp; Pembayaran</h2>
            <p className="mt-2">
              Layanan tersedia dalam paket Free, Starter, dan Pro dengan batas kuota generate PRD bulanan sebagaimana
              tercantum di halaman{" "}
              <Link href="/#harga" className="text-[#35d6ff] hover:underline">
                Harga
              </Link>
              . Pembayaran paket berbayar diproses lewat halaman{" "}
              <Link href="/billing" className="text-[#35d6ff] hover:underline">
                Billing
              </Link>{" "}
              dan paket aktif segera setelah pembayaran terverifikasi.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">4. Batasan Tanggung Jawab</h2>
            <p className="mt-2">
              Output dokumen yang dihasilkan AI bersifat rekomendasi teknis untuk membantu pengembangan perangkat lunak.
              Pengguna disarankan meninjau kembali kesesuaian arsitektur, keamanan, dan kebutuhan bisnis sebelum
              diterapkan ke lingkungan produksi.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
