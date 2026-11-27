import Link from "next/link";
import { Reveal, Stagger, StaggerItem, WordReveal } from "@/components/motion/Reveal";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { currentUser } from "@/lib/auth";
import { BADGES, getLeaderboard } from "@/lib/community";

export const metadata = {
  title: "Komunitas — MyPRD",
  description: "Papan peringkat builder MyPRD: siapa paling produktif menyusun PRD, plus lencana yang bisa dikumpulkan.",
};

const MEDAL_STYLE = [
  "border-amber-400/60 bg-amber-400/20 text-amber-300",
  "border-slate-300/50 bg-slate-300/15 text-slate-200",
  "border-orange-400/50 bg-orange-500/15 text-orange-300",
] as const;

export default async function KomunitasPage() {
  const user = await currentUser();
  const board = getLeaderboard();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader authed={user !== null} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#35d6ff]">Komunitas</p>
        <WordReveal text="Papan peringkat builder" className="mt-2 text-3xl font-bold text-white" />
        <p className="mt-3 text-slate-300">
          Susun PRD, kumpulkan lencana, dan diskusi bareng builder lain di Discord.
        </p>
        <a
          href="https://discord.gg/yVQWsrQDbM"
          target="_blank"
          rel="noreferrer"
          className="btn-shine mt-4 inline-block rounded-xl bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] px-4 py-2 text-sm font-semibold text-slate-950 transition hover:brightness-110"
        >
          Gabung Discord →
        </a>

        <h2 className="mt-10 text-lg font-semibold text-white">Peringkat PRD terbanyak</h2>
        {board.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-400">
            Belum ada peringkat — jadilah yang pertama menyusun PRD.
          </p>
        ) : (
          <Stagger as="ol" inView={false} className="mt-4 space-y-2.5">
            {board.map((entry, index) => (
              <StaggerItem
                as="li"
                key={`${entry.name}-${index}`}
                className="card-lift flex items-center gap-3 rounded-2xl border border-slate-800/90 bg-[#0b1022]/80 p-4"
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-sm font-bold ${
                    index < 3 ? `btn-shine ${MEDAL_STYLE[index]}` : "border-slate-800 bg-slate-950 text-slate-400"
                  }`}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{entry.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {entry.prdCount} PRD · {entry.projectCount} project
                    {entry.badges.length > 0 ? ` · ${entry.badges.map((b) => b.name).join(", ")}` : ""}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        )}

        <Reveal delay={0.05}>
          <h2 className="mt-10 text-lg font-semibold text-white">Lencana yang bisa dikumpulkan</h2>
          <Stagger as="ul" className="mt-4 grid gap-3 sm:grid-cols-2">
            {BADGES.map((badge) => (
              <StaggerItem
                as="li"
                key={badge.id}
                className="card-lift rounded-2xl border border-slate-800/90 bg-[#0b1022]/80 p-4"
              >
                <p className="font-medium text-amber-300">{badge.name}</p>
                <p className="mt-1 text-sm text-slate-400">{badge.description}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </Reveal>

        {!user && (
          <Reveal delay={0.1}>
            <div className="glow-border mt-10 rounded-2xl bg-[#0b1022]/85 p-6 text-center">
              <p className="text-sm text-slate-300">Buat akun gratis untuk mulai mengejar peringkat.</p>
              <Link
                href="/register?next=/komunitas"
                className="btn-shine mt-4 inline-block rounded-xl bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110"
              >
                Daftar gratis
              </Link>
            </div>
          </Reveal>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
