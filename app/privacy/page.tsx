import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { currentUser } from "@/lib/auth";

export const metadata = {
  title: "Kebijakan Privasi — MyPRD",
  description: "Kebijakan privasi layanan MyPRD mengenai pengelolaan akun, data PRD, keamanan enkripsi, dan pembayaran.",
};

export default async function PrivacyPage() {
  const user = await currentUser();
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader authed={Boolean(user)} />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#35d6ff]">Legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Kebijakan Privasi</h1>
        <p className="mt-2 text-xs text-slate-400">Terakhir diperbarui: 27 November 2026</p>

        <div className="mt-8 space-y-6 rounded-2xl border border-slate-800/90 bg-[#0b1022]/80 p-6 text-sm leading-relaxed text-slate-300">
          <section>
            <h2 className="text-base font-semibold text-white">1. Data yang Kami Kumpulkan</h2>
            <p className="mt-2">
              Saat mendaftar atau menggunakan MyPRD, kami mengumpulkan informasi dasar akun seperti nama, alamat
              email, kata sandi (disimpan dalam bentuk hash <code className="text-sky-300">scrypt</code>), serta
              ide produk, riwayat percakapan, dan dokumen PRD yang kamu buat. Jika masuk dengan Google OAuth, kami
              hanya meminta izin profil dasar (<code className="text-sky-300">openid</code>,{" "}
              <code className="text-sky-300">email</code>, <code className="text-sky-300">profile</code>).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">2. Keamanan &amp; Enkripsi Data</h2>
            <p className="mt-2">
              Isi percakapan dan dokumen PRD disimpan terenkripsi menggunakan{" "}
              <code className="text-sky-300">AES-256-GCM</code> di database dan setiap proyek dibatasi ketat hanya
              untuk pemilik akun. Sesi login memakai cookie bertanda tangan <code className="text-sky-300">HttpOnly</code>{" "}
              dan dapat dicabut kapan saja saat logout.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">3. Pemrosesan AI &amp; Pembayaran</h2>
            <p className="mt-2">
              Prompt ide dan klarifikasi dikirim ke penyedia model AI yang kamu pilih untuk menghasilkan PRD. Untuk
              pembayaran paket langganan (QRIS, e-wallet, atau transfer bank melalui gateway pembayaran resmi), kami
              hanya menyimpan ID order, nominal, dan status transaksi — tidak menyimpan kredensial kartu atau saldo
              dompet digital.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-white">4. Hak Pengguna &amp; Kontak</h2>
            <p className="mt-2">
              Kamu dapat menghapus proyek dan dokumen PRD langsung dari halaman{" "}
              <Link href="/dashboard" className="text-[#35d6ff] hover:underline">
                Dashboard
              </Link>{" "}
              atau memperbarui data profil di{" "}
              <Link href="/settings" className="text-[#35d6ff] hover:underline">
                Pengaturan
              </Link>
              . Untuk permintaan penghapusan akun atau pertanyaan privasi, hubungi admin melalui komunitas resmi MyPRD
              di Discord.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
