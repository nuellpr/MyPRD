"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type RefObject } from "react";
import { IconBolt, IconLayers, IconSettings, IconShield, IconSparkles } from "./icons";

interface MenuItem {
  href: string;
  title: string;
  description: string;
  badge?: string;
  icon: "templates" | "community" | "pricing" | "faq" | "dashboard" | "billing" | "settings";
}

const PUBLIC_ITEMS: MenuItem[] = [
  {
    href: "/templates",
    title: "Template & Showcase",
    description: "Starter kit siap pakai dan prompt install untuk AI coding agent.",
    badge: "Baru",
    icon: "templates",
  },
  {
    href: "/komunitas",
    title: "Komunitas",
    description: "Papan peringkat builder, lencana, dan ruang diskusi Discord.",
    icon: "community",
  },
  {
    href: "/#harga",
    title: "Harga",
    description: "Mulai gratis dengan kuota bulanan, upgrade kapan saja.",
    icon: "pricing",
  },
  {
    href: "/#faq",
    title: "FAQ",
    description: "Pertanyaan umum seputar PRD, keamanan data, dan export.",
    icon: "faq",
  },
];

const AUTH_ITEMS: MenuItem[] = [
  {
    href: "/dashboard",
    title: "Dashboard",
    description: "Kelola project PRD dan buat ide aplikasi baru.",
    icon: "dashboard",
  },
  {
    href: "/billing",
    title: "Billing & Paket",
    description: "Cek kuota, riwayat order, atau upgrade ke Starter/Pro.",
    icon: "billing",
  },
  {
    href: "/settings",
    title: "Pengaturan",
    description: "Profil akun, keamanan password, dan model AI default.",
    icon: "settings",
  },
];

function ItemIcon({ kind }: { kind: MenuItem["icon"] }) {
  switch (kind) {
    case "templates":
      return <IconLayers className="h-4 w-4" />;
    case "community":
      return <IconSparkles className="h-4 w-4" />;
    case "pricing":
      return <IconBolt className="h-4 w-4" />;
    case "faq":
      return <IconShield className="h-4 w-4" />;
    case "dashboard":
      return <IconSparkles className="h-4 w-4" />;
    case "billing":
      return <IconBolt className="h-4 w-4" />;
    case "settings":
      return <IconSettings className="h-4 w-4" />;
  }
}

export function MenuDrawer({
  open,
  onClose,
  authed,
  triggerRef,
}: {
  open: boolean;
  onClose: () => void;
  authed: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const reduced = useReducedMotion();

  // Tutup drawer saat rute berubah.
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      if (open) onClose();
    }
  }, [pathname, open, onClose]);

  // Kunci scroll body, Esc untuk menutup, dan kembalikan fokus saat ditutup.
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const focusTimer = window.setTimeout(() => closeBtnRef.current?.focus(), 20);
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", onKey);
      return () => {
        window.clearTimeout(focusTimer);
        window.removeEventListener("keydown", onKey);
        document.body.style.overflow = prevOverflow;
      };
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef.current?.focus();
    }
  }, [open, onClose, triggerRef]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="no-print fixed inset-0 z-50 flex">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.01 : 0.2 }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs"
          />

          <motion.aside
            id="nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu navigasi Jelajahi"
            initial={reduced ? { opacity: 0 } : { x: "-100%" }}
            animate={reduced ? { opacity: 1 } : { x: 0 }}
            exit={reduced ? { opacity: 0 } : { x: "-100%" }}
            transition={{ duration: reduced ? 0.01 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 flex h-full w-full max-w-sm flex-col border-r border-slate-800/80 bg-[#070b16] p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#35d6ff]">Navigasi</p>
                <h2 className="mt-0.5 text-lg font-semibold text-white">Jelajahi</h2>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={onClose}
                aria-label="Tutup menu"
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-800 text-slate-300 transition hover:border-slate-600 hover:bg-slate-900 hover:text-white"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav aria-label="Jelajahi" className="mt-5 flex-1 space-y-6 overflow-y-auto pr-1">
              <div className="space-y-2.5">
                {PUBLIC_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className="group flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-900/45 p-3.5 transition hover:border-[#4f7cff]/50 hover:bg-slate-900/80"
                  >
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-700/80 bg-slate-950 text-[#35d6ff] transition group-hover:border-[#35d6ff]/50">
                      <ItemIcon kind={item.icon} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-100 group-hover:text-white">
                          {item.title}
                        </span>
                        {item.badge ? (
                          <span className="rounded-full border border-[#35d6ff]/40 bg-[#35d6ff]/15 px-2 py-0.5 text-[10px] font-semibold text-[#7fe3ff]">
                            {item.badge}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">{item.description}</p>
                    </div>
                  </Link>
                ))}
              </div>

              {authed ? (
                <div>
                  <p className="mb-2.5 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Workspace</p>
                  <div className="space-y-2.5">
                    {AUTH_ITEMS.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className="group flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-900/45 p-3.5 transition hover:border-[#a78bfa]/50 hover:bg-slate-900/80"
                      >
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-700/80 bg-slate-950 text-[#a78bfa] transition group-hover:border-[#a78bfa]/50">
                          <ItemIcon kind={item.icon} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-semibold text-slate-100 group-hover:text-white">
                            {item.title}
                          </span>
                          <p className="mt-1 text-xs leading-relaxed text-slate-400">{item.description}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </nav>

            <div className="mt-4 border-t border-slate-800/80 pt-4 text-xs text-slate-500">
              <div className="flex items-center justify-between">
                <span>MyPRD · ngoding pake AI</span>
                <a
                  href="https://discord.gg/w3pn2Ey3P"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#35d6ff] hover:underline"
                >
                  Discord →
                </a>
              </div>
            </div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
