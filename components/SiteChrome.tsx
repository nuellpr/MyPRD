"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { IconLayers, IconSettings, IconUser } from "./icons";
import { GlassySidebar } from "./GlassySidebar";
import { CountUp } from "./motion/CountUp";

export interface HeaderStats {
  users: number;
  prds: number;
}

export function SiteHeader({
  authed,
  stats,
  floatingDock = true,
}: {
  authed: boolean;
  stats?: HeaderStats;
  floatingDock?: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={`no-print sticky top-0 z-30 border-b transition-colors duration-300 ${
          scrolled
            ? "border-slate-800/80 bg-[#060912]/80 backdrop-blur-md"
            : "border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="group flex items-center gap-2.5 font-semibold tracking-tight">
              <Image
                src="/logo-mark.png"
                alt=""
                width={160}
                height={132}
                sizes="48px"
                priority
                className="float-y logo-glow h-9 w-auto rounded-lg transition-transform duration-300 group-hover:scale-105"
              />
              <span className="text-base font-bold tracking-tight whitespace-nowrap sm:text-lg">
                <span className="text-white">My</span>
                <span className="bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] bg-clip-text text-transparent">
                  PRD
                </span>
              </span>
            </Link>
          </div>

          {stats ? (
            <div className="hidden items-center gap-4 md:flex" aria-label="Statistik platform">
              <div className="flex items-center gap-1.5 rounded-full border border-slate-800/80 bg-slate-900/50 px-3 py-1 text-xs text-slate-300">
                <IconUser className="h-3.5 w-3.5 text-[#35d6ff]" />
                <CountUp value={stats.users} compact className="font-semibold text-white" />
                <span className="text-slate-400">User</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-slate-800/80 bg-slate-900/50 px-3 py-1 text-xs text-slate-300">
                <IconLayers className="h-3.5 w-3.5 text-[#a78bfa]" />
                <CountUp value={stats.prds} compact className="font-semibold text-white" />
                <span className="text-slate-400">PRD</span>
              </div>
            </div>
          ) : (
            <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
              <Link href="/#cara-kerja" className="transition-colors hover:text-white">
                Cara Kerja
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
            </nav>
          )}

          <div className="flex shrink-0 items-center gap-2">
            {authed ? (
              <>
                <Link
                  href="/settings"
                  aria-label="Pengaturan"
                  title="Pengaturan"
                  className="grid h-9 w-9 place-items-center rounded-lg border border-slate-800/80 bg-slate-900/50 text-slate-400 transition hover:border-slate-600 hover:text-white"
                >
                  <IconSettings className="h-4 w-4" />
                </Link>
                <Link
                  href="/dashboard"
                  className="btn-shine whitespace-nowrap rounded-full bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] px-4 py-2 text-xs font-semibold text-slate-950 transition hover:brightness-110 sm:text-sm"
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="whitespace-nowrap rounded-full border border-slate-700/80 bg-slate-900/60 px-3.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-[#35d6ff]/60 hover:text-white sm:px-4 sm:text-sm"
                >
                  Masuk
                </Link>
                <Link
                  href="/register"
                  className="btn-shine whitespace-nowrap rounded-full bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] px-3.5 py-1.5 text-xs font-semibold text-slate-950 transition hover:brightness-110 sm:px-4 sm:text-sm"
                >
                  Mulai Gratis
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <GlassySidebar
        authed={authed}
        open={menuOpen}
        onOpenChange={setMenuOpen}
        floatingDock={floatingDock}
      />
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="no-print relative bg-[#060912]">
      <div
        aria-hidden
        className="text-shimmer h-px w-full bg-linear-to-r from-transparent via-[#35d6ff]/50 to-transparent"
      />
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2">
          <span>Product by</span>
          <span className="font-semibold text-slate-200">MyPRD</span>
          <span className="text-slate-600">·</span>
          <span>© {new Date().getFullYear()}</span>
        </p>
        <p className="flex flex-wrap items-center gap-5">
          <Link href="/templates" className="transition hover:text-white">
            Template
          </Link>
          <Link href="/komunitas" className="transition hover:text-white">
            Komunitas
          </Link>
          <Link href="/privacy" className="transition hover:text-white">
            Privasi
          </Link>
          <Link href="/terms" className="transition hover:text-white">
            Ketentuan
          </Link>
          <a
            href="https://discord.gg/yVQWsrQDbM"
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-[#35d6ff]"
          >
            Discord
          </a>
          <a href="https://youtube.com" target="_blank" rel="noreferrer" className="transition hover:text-white">
            YouTube
          </a>
        </p>
      </div>
    </footer>
  );
}
