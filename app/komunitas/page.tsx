import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { BADGES, getLeaderboard } from "@/lib/community";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata = {
  title: "Komunitas — MyPRD",
  description: "Papan peringkat builder MyPRD: siapa paling produktif menyusun PRD, plus lencana yang bisa dikumpulkan.",
};

export default async function KomunitasPage() {
  const user = await currentUser();
  const board = getLeaderboard();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader authed={user !== null} />
      <main className="mx-auto w-full max-w-3xl px-5 py-12">
        <p className="text-sm font-medium text-sky-400">Komunitas</p>
        <h1 className="mt-2 text-3xl font-bold">Papan peringkat builder</h1>
        <p className="mt-3 text-slate-300">
          Susun PRD, kumpulkan lencana, dan diskusi bareng builder lain di Discord.
        </p>
        <a
          href="https://discord.gg/w3pn2Ey3P"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400"
        >
          Gabung Discord →
        </a>

        <h2 className="mt-10 text-lg font-semibold">Peringkat PRD terbanyak</h2>
        {board.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
            Belum ada peringkat — jadilah yang pertama menyusun PRD.
          </p>
        ) : (
          <ol className="mt-4 space-y-2">
            {board.map((entry, index) => (
              <li
                key={`${entry.name}-${index}`}
                className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4"
              >
                <span className="w-8 shrink-0 text-center text-lg font-bold text-slate-400">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{entry.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {entry.prdCount} PRD · {entry.projectCount} project
                    {entry.badges.length > 0 ? ` · ${entry.badges.map((b) => b.name).join(", ")}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}

        <h2 className="mt-10 text-lg font-semibold">Lencana yang bisa dikumpulkan</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {BADGES.map((badge) => (
            <li key={badge.id} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <p className="font-medium text-amber-300">{badge.name}</p>
              <p className="mt-1 text-sm text-slate-400">{badge.description}</p>
            </li>
          ))}
        </ul>

        {!user && (
          <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-center">
            <p className="text-sm text-slate-300">Buat akun gratis untuk mulai mengejar peringkat.</p>
            <Link
              href="/register?next=/komunitas"
              className="mt-4 inline-block rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400"
            >
              Daftar gratis
            </Link>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
