import Link from "next/link";

export function SiteHeader({ authed }: { authed: boolean }) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 text-sm font-bold text-slate-950">
            MP
          </span>
          <span className="text-base">MyPRD</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
          <Link href="/#cara-kerja" className="hover:text-white">
            Cara Kerja
          </Link>
          <Link href="/#fitur" className="hover:text-white">
            Fitur
          </Link>
          <Link href="/#harga" className="hover:text-white">
            Harga
          </Link>
          <Link href="/#faq" className="hover:text-white">
            FAQ
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {authed ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:text-white">
                Masuk
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400"
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
          <a href="https://discord.com" target="_blank" rel="noreferrer" className="hover:text-white">
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
