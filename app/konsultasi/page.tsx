import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { billingProvider, CONSULT_PRODUCT, midtransSnapJsUrl } from "@/lib/billing";
import { isAdminEmail } from "@/lib/env";
import { listAllBookings, listBookings } from "@/lib/repo";
import { ConsultPanel } from "@/components/ConsultPanel";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata = {
  title: "Konsultasi — MyPRD",
  description: "Booking sesi konsultasi 1-on-1: review PRD, arahan tech stack, dan strategi eksekusi.",
};

const BENEFITS = [
  "Review PRD hasil generate sebelum kamu eksekusi ke AI coding agent",
  "Arahan tech stack & arsitektur yang pas untuk idemu",
  "Strategi breakdown task supaya hemat token saat coding",
  "Jadwal fleksibel, sesi 60 menit via Google Meet",
];

export default async function KonsultasiPage() {
  const user = await currentUser();
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader authed={user !== null} />
      <main className="mx-auto w-full max-w-3xl px-5 py-12">
        <p className="text-sm font-medium text-sky-400">Konsultasi & coaching</p>
        <h1 className="mt-2 text-3xl font-bold">Sesi 1-on-1 bareng praktisi</h1>
        <p className="mt-3 text-slate-300">
          Stuck di PRD, ragu pilih tech stack, atau mau review sebelum coding? Booking sesi 60 menit — bayar di
          muka, jadwal kami hubungi via kontak yang kamu isi.
        </p>
        <ul className="mt-6 space-y-2 text-sm text-slate-300">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex gap-2">
              <span className="text-sky-400">✓</span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8">
          {user ? (
            <ConsultPanel
              bookings={listBookings(user.id)}
              provider={billingProvider()}
              snapJsUrl={midtransSnapJsUrl()}
              product={CONSULT_PRODUCT}
              isAdmin={isAdminEmail(user.email)}
              allBookings={isAdminEmail(user.email) ? listAllBookings() : []}
            />
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-center">
              <p className="text-sm text-slate-300">Masuk dulu untuk booking sesi konsultasi.</p>
              <div className="mt-4 flex justify-center gap-3">
                <Link
                  href="/login?next=/konsultasi"
                  className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400"
                >
                  Masuk
                </Link>
                <Link
                  href="/register?next=/konsultasi"
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
                >
                  Daftar
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
