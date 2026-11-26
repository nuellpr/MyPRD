import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { WordReveal } from "@/components/motion/Reveal";
import { currentUser } from "@/lib/auth";
import { googleConfigured } from "@/lib/oauth";

// Lihat catatan di app/(auth)/login/page.tsx.
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await currentUser()) redirect("/dashboard");

  return (
    <div>
      <WordReveal text="Bikin akun MyPRD" className="text-2xl font-semibold text-white" />
      <p className="mt-1 mb-6 text-sm text-slate-400">Gratis, langsung dapat kuota generate PRD bulanan.</p>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-slate-900/50" />}>
        <AuthForm mode="register" googleEnabled={googleConfigured()} />
      </Suspense>
      <p className="mt-6 text-center text-sm text-slate-400">
        Sudah punya akun?{" "}
        <Link href="/login" className="text-[#35d6ff] hover:underline">
          Masuk
        </Link>
      </p>
    </div>
  );
}
