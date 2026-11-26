"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AutoHeight } from "@/components/motion/AutoHeight";

export function AuthCard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const showTabs = pathname === "/login" || pathname === "/register";

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="glow-border rounded-3xl border border-slate-800/80 bg-[#0b1022]/85 p-7 shadow-2xl backdrop-blur-md sm:p-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo-mark.png"
              alt=""
              width={520}
              height={430}
              priority
              className="logo-glow h-8 w-auto rounded-lg"
            />
            <span className="text-sm font-bold tracking-tight text-white">
              My<span className="bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] bg-clip-text text-transparent">PRD</span>
            </span>
          </Link>

          {showTabs ? (
            <div className="flex rounded-full border border-slate-800 bg-[#060912] p-1 text-xs">
              {[
                { href: "/login", label: "Masuk" },
                { href: "/register", label: "Daftar" },
              ].map((tab) => {
                const active = pathname === tab.href;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`relative rounded-full px-3.5 py-1 font-medium transition-colors ${
                      active ? "text-slate-950" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {active ? (
                      <motion.span
                        layoutId="auth-tab"
                        transition={{ duration: reduced ? 0.01 : 0.25, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute inset-0 rounded-full bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa]"
                      />
                    ) : null}
                    <span className="relative z-10">{tab.label}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>

        <AutoHeight className="-m-1">
          <div className="p-1">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: reduced ? 0.01 : 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </div>
        </AutoHeight>
      </div>
    </div>
  );
}
