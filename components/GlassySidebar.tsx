"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { IconBolt, IconLayers, IconSettings, IconShield, IconSparkles, IconUser } from "./icons";

interface NavItem {
  id: string;
  href: string;
  label: string;
  sectionLabel: string;
  badge?: string;
  icon: "home" | "dashboard" | "templates" | "community" | "billing";
}

interface RecentProject {
  id: string;
  title: string;
  status: string;
}

interface SidebarUser {
  name: string;
  email: string;
  planName: string;
  quotaUsed: number;
  quotaLimit: number;
}

const DOT_COLORS = [
  "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]",
  "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]",
  "bg-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.8)]",
] as const;

function NavIcon({ kind, className = "h-4 w-4" }: { kind: NavItem["icon"]; className?: string }) {
  switch (kind) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
        </svg>
      );
    case "dashboard":
      return <IconSparkles className={className} />;
    case "templates":
      return <IconLayers className={className} />;
    case "community":
      return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "billing":
      return <IconBolt className={className} />;
  }
}

function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/") return pathname === "/";
  if (item.href.startsWith("/#")) return false;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function sectionLabelForPath(pathname: string): string {
  if (pathname === "/") return "BERANDA";
  if (pathname.startsWith("/dashboard")) return "DASHBOARD";
  if (pathname.startsWith("/templates")) return "TEMPLATE";
  if (pathname.startsWith("/komunitas")) return "KOMUNITAS";
  if (pathname.startsWith("/billing")) return "BILLING";
  if (pathname.startsWith("/settings")) return "PENGATURAN";
  return "MYPRD";
}

function QuotaRing({ percent, size = 34 }: { percent: number; size?: number }) {
  const stroke = 2.6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(8, Math.min(100, percent));
  const offset = c - (clamped / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.16)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#fbbf24"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

export function GlassySidebar({
  authed,
  open,
  onOpenChange,
  triggerRef,
  floatingDock = true,
}: {
  authed: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  floatingDock?: boolean;
}) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState<RecentProject[]>([]);
  const [user, setUser] = useState<SidebarUser | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const prevPathRef = useRef(pathname);
  const wasOpenRef = useRef(false);

  const items = useMemo<NavItem[]>(
    () => [
      { id: "home", href: "/", label: "Beranda", sectionLabel: "BERANDA", icon: "home" },
      authed
        ? { id: "dashboard", href: "/dashboard", label: "Dashboard", sectionLabel: "DASHBOARD", icon: "dashboard" }
        : { id: "workflow", href: "/#cara-kerja", label: "Cara Kerja", sectionLabel: "CARA KERJA", icon: "dashboard" },
      { id: "templates", href: "/templates", label: "Template", sectionLabel: "TEMPLATE", badge: "Baru", icon: "templates" },
      { id: "community", href: "/komunitas", label: "Komunitas", sectionLabel: "KOMUNITAS", icon: "community" },
      authed
        ? { id: "billing", href: "/billing", label: "Billing & QRIS", sectionLabel: "BILLING", icon: "billing" }
        : { id: "pricing", href: "/#harga", label: "Harga & Paket", sectionLabel: "HARGA", icon: "billing" },
    ],
    [authed],
  );

  // Tutup panel saat navigasi pindah rute.
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      if (open) onOpenChange(false);
    }
  }, [pathname, open, onOpenChange]);

  // Muat profil & project terbaru untuk isi sidebar saat sudah login.
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    Promise.allSettled([
      fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/projects").then((r) => (r.ok ? r.json() : null)),
    ]).then(([meRes, prjRes]) => {
      if (cancelled) return;
      if (meRes.status === "fulfilled" && meRes.value?.user) {
        const u = meRes.value.user as { name?: string; email?: string; plan?: string };
        const q = meRes.value.quota as { used?: number; limit?: number } | null;
        const planRaw = String(u.plan ?? "free");
        setUser({
          name: String(u.name || u.email || "Builder"),
          email: String(u.email || ""),
          planName: planRaw.charAt(0).toUpperCase() + planRaw.slice(1),
          quotaUsed: Number(q?.used ?? 0),
          quotaLimit: Math.max(1, Number(q?.limit ?? 5)),
        });
      }
      if (prjRes.status === "fulfilled" && Array.isArray(prjRes.value?.projects)) {
        const rows = prjRes.value.projects as { id?: string; title?: string; status?: string }[];
        setProjects(
          rows.slice(0, 3).map((p) => ({
            id: String(p.id ?? ""),
            title: String(p.title ?? "Project baru"),
            status: String(p.status ?? "chatting"),
          })),
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [authed]);

  // Shortcut Cmd/Ctrl+K untuk buka + fokus search, Esc untuk menutup, serta kembalikan fokus.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
        if (!open) {
          window.setTimeout(() => searchInputRef.current?.focus(), 80);
        }
        return;
      }
      if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      return;
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef?.current?.focus();
    }
  }, [open, triggerRef]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = normalizedQuery
    ? items.filter((item) => item.label.toLowerCase().includes(normalizedQuery))
    : items;
  const filteredProjects = normalizedQuery
    ? projects.filter((p) => p.title.toLowerCase().includes(normalizedQuery))
    : projects;

  const activeItem = items.find((item) => isNavActive(pathname, item));
  const railTitle = activeItem?.sectionLabel ?? sectionLabelForPath(pathname);
  const quotaPct = user ? Math.round((user.quotaUsed / user.quotaLimit) * 100) : 25;
  const userInitial = (user?.name || user?.email || (authed ? "M" : "G")).trim().charAt(0).toUpperCase();

  const quickSpots = authed && projects.length > 0
    ? projects.map((p, idx) => ({
        key: p.id,
        href: `/dashboard/${p.id}`,
        label: p.title,
        dot: DOT_COLORS[idx % DOT_COLORS.length],
      }))
    : [
        { key: "tpl", href: "/templates", label: "Starter Kit Template", dot: DOT_COLORS[0] },
        { key: "kom", href: "/komunitas", label: "Komunitas Builder", dot: DOT_COLORS[1] },
        { key: "faq", href: "/#faq", label: "FAQ & Keamanan", dot: DOT_COLORS[2] },
      ];

  function openWithSearch() {
    onOpenChange(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 90);
  }

  return (
    <>
      {/* Desktop Collapsed Floating Pill Dock */}
      {floatingDock && !open ? (
        <aside
          aria-label="Dock navigasi cepat"
          className="no-print glassy-sidebar-shell fixed top-1/2 left-3.5 z-40 hidden w-[62px] -translate-y-1/2 flex-col items-center gap-2 rounded-[34px] px-2 py-3 xl:flex"
        >
          <button
            type="button"
            onClick={() => onOpenChange(true)}
            aria-label="Perluas sidebar navigasi"
            title="Perluas navigasi (⌘K)"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/25 bg-white/15 shadow-inner transition hover:scale-105 hover:bg-white/25"
          >
            <Image src="/logo-mark.png" alt="MyPRD" width={36} height={30} className="h-6 w-auto" />
          </button>

          <button
            type="button"
            onClick={openWithSearch}
            aria-label="Cari halaman atau project"
            title="Cari (⌘K)"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/10 text-slate-200 transition hover:bg-white/20 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>

          <nav aria-label="Menu utama" className="mt-1 flex flex-col items-center gap-1.5">
            {items.map((item) => {
              const active = isNavActive(pathname, item);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-label={item.label}
                  title={item.label}
                  className={`group relative grid h-10 w-10 place-items-center rounded-full transition ${
                    active
                      ? "bg-white text-slate-950 shadow-[0_6px_20px_rgba(255,255,255,0.35)]"
                      : "text-slate-200/85 hover:bg-white/15 hover:text-white"
                  }`}
                >
                  {active ? (
                    <motion.span
                      layoutId={reduced ? undefined : "glassy-pill-active"}
                      className="absolute -left-2 h-2 w-2 rounded-full bg-white shadow-[0_0_8px_#fff]"
                    />
                  ) : null}
                  <NavIcon kind={item.icon} className="h-4 w-4" />
                  <span className="pointer-events-none absolute left-13 z-50 hidden rounded-lg border border-white/20 bg-slate-950/95 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-white shadow-xl group-hover:block">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="my-1 h-px w-7 bg-white/15" />

          <div className="flex flex-col items-center gap-2 py-0.5">
            {quickSpots.map((spot) => (
              <Link
                key={spot.key}
                href={spot.href}
                aria-label={spot.label}
                title={spot.label}
                className="group relative grid h-6 w-6 place-items-center rounded-full transition hover:bg-white/15"
              >
                <span className={`h-2 w-2 rounded-full ${spot.dot}`} />
                <span className="pointer-events-none absolute left-10 z-50 hidden rounded-lg border border-white/20 bg-slate-950/95 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-white shadow-xl group-hover:block">
                  {spot.label}
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-1 flex flex-col items-center gap-2">
            <Link
              href={authed ? "/billing" : "/#harga"}
              aria-label="Kuota & Upgrade"
              title={user ? `${user.planName} · ${quotaPct}% terpakai` : "Lihat paket harga"}
              className="relative grid h-9 w-9 place-items-center rounded-full bg-slate-950/50 transition hover:scale-105"
            >
              <QuotaRing percent={quotaPct} size={34} />
              <span className="absolute text-[9px] font-bold text-amber-300">⚡</span>
            </Link>

            <Link
              href={authed ? "/settings" : "/login"}
              aria-label={authed ? "Profil & Pengaturan" : "Masuk akun"}
              title={user ? user.name : "Masuk ke MyPRD"}
              className="grid h-9 w-9 place-items-center rounded-full bg-linear-to-br from-amber-300 via-orange-400 to-rose-400 text-xs font-bold text-slate-950 shadow-md transition hover:scale-105"
            >
              {userInitial}
            </Link>
          </div>
        </aside>
      ) : null}

      {/* Expanded Dual-Pane Curved Glassy Sidebar V10 */}
      <AnimatePresence>
        {open ? (
          <div className="no-print fixed inset-0 z-50 flex items-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0.01 : 0.2 }}
              onClick={() => onOpenChange(false)}
              aria-hidden="true"
              className="fixed inset-0 bg-slate-950/55 backdrop-blur-xs"
            />

            <motion.aside
              ref={panelRef}
              id="nav-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Sidebar navigasi MyPRD"
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: -24, scale: 0.96 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: -24, scale: 0.96 }}
              transition={reduced ? { duration: 0.01 } : { type: "spring", stiffness: 360, damping: 30 }}
              className="glassy-sidebar-shell relative z-10 ml-3 flex max-h-[calc(100dvh-28px)] w-[306px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[28px]"
            >
              {/* Left Frosted Glass Pane */}
              <div className="flex min-w-0 flex-1 flex-col py-4 pl-3.5">
                {/* Brand & Collapse */}
                <div className="flex items-center justify-between gap-2 pr-3 pb-3">
                  <Link href="/" onClick={() => onOpenChange(false)} className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/25 bg-white/15 shadow-inner">
                      <Image src="/logo-mark.png" alt="MyPRD" width={36} height={30} className="h-5 w-auto" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold tracking-tight text-white">MyPRD</span>
                      <span className="block truncate text-[10px] text-sky-100/75">AI PRD Workspace</span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    aria-label="Ciutkan navigasi"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                </div>

                {/* Live Search Pill */}
                <div className="pr-3">
                  <label className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/85 focus-within:border-[#35d6ff]/70 focus-within:bg-white/15">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-white/65" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <circle cx="11" cy="11" r="7" />
                      <path d="m20 20-3.5-3.5" />
                    </svg>
                    <input
                      ref={searchInputRef}
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Cari menu / project..."
                      className="w-full min-w-0 bg-transparent text-xs text-white placeholder:text-white/55 focus:outline-none"
                    />
                    <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/70">⌘K</kbd>
                  </label>
                </div>

                {/* Scrollable Links & Recent Projects */}
                <div className="mt-3.5 flex-1 space-y-4 overflow-x-clip overflow-y-auto pt-2">
                  <nav aria-label="Menu navigasi" className="space-y-1.5">
                    {filteredItems.map((item) => {
                      const active = isNavActive(pathname, item);
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={() => onOpenChange(false)}
                          className={
                            active
                              ? "glassy-active-cutout flex items-center justify-between rounded-l-full rounded-r-none bg-white py-2.5 pr-4 pl-3.5 text-xs font-semibold text-slate-950 shadow-md"
                              : "mr-3 flex items-center justify-between rounded-full border border-white/10 bg-white/[0.07] px-3.5 py-2.5 text-xs font-medium text-white/85 transition hover:border-white/20 hover:bg-white/[0.15] hover:text-white"
                          }
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <NavIcon kind={item.icon} className="h-4 w-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </span>
                          {item.badge && !active ? (
                            <span className="rounded-full bg-[#35d6ff]/20 px-2 py-0.5 text-[10px] font-semibold text-[#7fe3ff]">
                              {item.badge}
                            </span>
                          ) : null}
                        </Link>
                      );
                    })}
                    {filteredItems.length === 0 ? (
                      <p className="px-2 py-1 text-[11px] text-white/60">Menu tidak ditemukan.</p>
                    ) : null}
                  </nav>

                  {/* Projects / Quick Links */}
                  <div className="mr-3 border-t border-white/15 pt-3">
                    <div className="mb-2 flex items-center justify-between px-1">
                      <span className="text-[10px] font-semibold tracking-[0.18em] text-white/60 uppercase">
                        {authed ? "Projects" : "Eksplorasi"}
                      </span>
                      <Link
                        href={authed ? "/dashboard" : "/register"}
                        onClick={() => onOpenChange(false)}
                        aria-label={authed ? "Buat project baru" : "Mulai gratis"}
                        className="grid h-5 w-5 place-items-center rounded-full border border-white/20 bg-white/10 text-xs text-white transition hover:bg-white/25"
                      >
                        +
                      </Link>
                    </div>
                    <div className="space-y-1">
                      {authed ? (
                        filteredProjects.length > 0 ? (
                          filteredProjects.map((prj, idx) => (
                            <Link
                              key={prj.id}
                              href={`/dashboard/${prj.id}`}
                              onClick={() => onOpenChange(false)}
                              className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-xs text-white/85 transition hover:bg-white/10 hover:text-white"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLORS[idx % DOT_COLORS.length]}`} />
                                <span className="truncate">{prj.title}</span>
                              </span>
                              <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/75">
                                {prj.status === "prd_ready" ? "PRD" : "Chat"}
                              </span>
                            </Link>
                          ))
                        ) : (
                          <Link
                            href="/dashboard"
                            onClick={() => onOpenChange(false)}
                            className="block rounded-xl px-2.5 py-1.5 text-[11px] text-white/70 transition hover:bg-white/10 hover:text-white"
                          >
                            {normalizedQuery ? "Project tidak cocok." : "Buat PRD pertamamu →"}
                          </Link>
                        )
                      ) : (
                        <>
                          <Link
                            href="/templates"
                            onClick={() => onOpenChange(false)}
                            className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-white/85 transition hover:bg-white/10"
                          >
                            <span className={`h-2 w-2 rounded-full ${DOT_COLORS[0]}`} />
                            <span className="truncate">Starter Kit Codebase</span>
                          </Link>
                          <Link
                            href="/#faq"
                            onClick={() => onOpenChange(false)}
                            className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-white/85 transition hover:bg-white/10"
                          >
                            <span className={`h-2 w-2 rounded-full ${DOT_COLORS[1]}`} />
                            <span className="truncate">FAQ & Enkripsi</span>
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Quota / Upgrade Card */}
                <div className="mt-3 mr-3 space-y-2.5 border-t border-white/15 pt-3">
                  <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/15 bg-slate-950/45 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="relative grid h-8 w-8 shrink-0 place-items-center">
                        <QuotaRing percent={quotaPct} size={32} />
                        <span className="absolute text-[9px] font-bold text-amber-300">⚡</span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-white">
                          {user ? `Paket ${user.planName}` : "Gratis dicoba"}
                        </p>
                        <p className="truncate text-[10px] text-white/65">
                          {user ? `${user.quotaUsed}/${user.quotaLimit} PRD dipakai` : "QRIS & multi-AI"}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={authed ? "/billing" : "/register"}
                      onClick={() => onOpenChange(false)}
                      className="shrink-0 rounded-full bg-linear-to-r from-amber-300 to-amber-400 px-2.5 py-1 text-[11px] font-bold text-slate-950 transition hover:brightness-110"
                    >
                      {authed ? "Upgrade" : "Mulai"}
                    </Link>
                  </div>

                  {/* User Footer */}
                  {authed ? (
                    <Link
                      href="/settings"
                      onClick={() => onOpenChange(false)}
                      className="flex items-center gap-2.5 rounded-2xl px-1.5 py-1 transition hover:bg-white/10"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-linear-to-br from-amber-300 via-orange-400 to-rose-400 text-xs font-bold text-slate-950">
                        {userInitial}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-white">
                          {user?.name || "Akun Builder"}
                        </span>
                        <span className="block truncate text-[10px] text-white/65">
                          {user?.email || "Pengaturan akun"}
                        </span>
                      </span>
                      <IconSettings className="h-3.5 w-3.5 shrink-0 text-white/70" />
                    </Link>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Link
                        href="/login"
                        onClick={() => onOpenChange(false)}
                        className="flex-1 rounded-full border border-white/20 bg-white/10 py-1.5 text-center text-xs font-medium text-white transition hover:bg-white/20"
                      >
                        Masuk
                      </Link>
                      <Link
                        href="/register"
                        onClick={() => onOpenChange(false)}
                        className="flex-1 rounded-full bg-white py-1.5 text-center text-xs font-semibold text-slate-950 transition hover:brightness-95"
                      >
                        Daftar
                      </Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Slim White Action Rail */}
              <div className="flex w-[46px] shrink-0 flex-col items-center justify-between rounded-r-[27px] bg-white px-1.5 py-3.5 text-slate-600 shadow-[-6px_0_24px_rgba(0,0,0,0.18)]">
                <div className="flex flex-col items-center gap-2.5">
                  <Link
                    href={authed ? "/dashboard" : "/register"}
                    onClick={() => onOpenChange(false)}
                    aria-label={authed ? "Buka Dashboard" : "Mulai Gratis"}
                    title={authed ? "Dashboard" : "Mulai Gratis"}
                    className="grid h-8 w-8 place-items-center rounded-xl bg-linear-to-b from-[#4f7cff] to-[#2563eb] text-white shadow-md transition hover:scale-105"
                  >
                    <IconSparkles className="h-4 w-4" />
                  </Link>
                  <Link
                    href={authed ? "/billing" : "/#harga"}
                    onClick={() => onOpenChange(false)}
                    aria-label="Pembayaran & Paket"
                    title="Billing & QRIS"
                    className="grid h-8 w-8 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <IconBolt className="h-4 w-4" />
                  </Link>
                  <Link
                    href={authed ? "/settings" : "/login"}
                    onClick={() => onOpenChange(false)}
                    aria-label={authed ? "Pengaturan" : "Masuk"}
                    title={authed ? "Pengaturan" : "Masuk"}
                    className="grid h-8 w-8 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    {authed ? <IconSettings className="h-4 w-4" /> : <IconUser className="h-4 w-4" />}
                  </Link>
                  <Link
                    href="/komunitas"
                    onClick={() => onOpenChange(false)}
                    aria-label="Keamanan & Komunitas"
                    title="Komunitas & Lencana"
                    className="grid h-8 w-8 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <IconShield className="h-4 w-4" />
                  </Link>
                </div>

                <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-bold tracking-[0.22em] text-slate-400 select-none">
                  {railTitle}
                </span>
              </div>
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
