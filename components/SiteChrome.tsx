import Image from "next/image";
import Link from "next/link";
import { IconSettings } from "./icons";

export function SiteHeader({ authed }: { authed: boolean }) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="group flex items-center gap-2.5 font-semibold tracking-tight">
          <Image
            src="/logo-mark.png"
            alt=""
            width={520}
            height={430}
            priority
            className="logo-glow h-9 w-auto rounded-lg transition-transform duration-300 group-hover:scale-105"
          />
          <span className="text-lg">
            <span className="text-white">My</span>
            <span className="bg-linear-to-r from-sky-400 via-cyan-300 to-violet-400 bg-clip-text text-transparent">
              PRD
            </span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
          <Link href="/#cara-kerja" className="transition-colors hover:text-white">
            Cara Kerja
          </Link>
          <Link href="/#fitur" className="transition-colors hover:text-white">
            Fitur
          </Link>
          <Link href="/templates" className="transition-colors hover:text-white">
            Template
          </Link>
          <Link href="/komunitas" className="transition-colors hover:text-white">
            Komunitas
          </Link>
          <Link href="/#harga" className="transition-colors hover:text-white">
            Harga
          </Link>
          <Link href="/#faq" className="transition-colors hover:text-white">
            FAQ
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {authed ? (
            <>
              <Link
                href="/settings"
                aria-label="Pengaturan"
                title="Pengaturan"
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-900 hover:text-white"
              >
                <IconSettings className="h-5 w-5" />
              </Link>
              <Link
                href="/dashboard"
                className="btn-shine rounded-lg bg-linear-to-r from-sky-500 to-violet-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:brightness-110"
              >
                Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-white">
                Masuk
              </Link>
              <Link
                href="/register"
                className="btn-shine rounded-lg bg-linear-to-r from-sky-500 to-violet-400 px-4 py-2 text-sm font-medium text-slate-950 transition hover:brightness-110"
              >
                Mulai Gratis
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="no-print border-t border-slate-800/80 bg-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} MyPRD — dibuat untuk developer Indonesia.</p>
        <p className="flex gap-4">
          <a href="https://discord.gg/w3pn2Ey3P" target="_blank" rel="noreferrer" className="hover:text-white">
            Komunitas Discord
          </a>
          <a href="https://youtube.com" target="_blank" rel="noreferrer" className="hover:text-white">
            YouTube
          </a>
        </p>
      </div>
    </footer>
  );
}
