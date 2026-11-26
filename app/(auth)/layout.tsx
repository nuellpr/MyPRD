import Link from "next/link";
import type { ReactNode } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthShowcase } from "@/components/auth/AuthShowcase";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell relative flex min-h-full flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-800/80 bg-slate-900/50 px-3.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-[#35d6ff]/50 hover:text-white"
        >
          ← Beranda
        </Link>
      </div>

      <div className="mx-auto my-auto grid w-full max-w-6xl flex-1 items-center gap-8 py-8 lg:grid-cols-2 lg:py-10">
        <AuthShowcase />
        <main className="flex w-full items-center justify-center">
          <AuthCard>{children}</AuthCard>
        </main>
      </div>
    </div>
  );
}
