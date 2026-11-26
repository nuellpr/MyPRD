import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { WordReveal } from "@/components/motion/Reveal";
import { currentUser } from "@/lib/auth";
import { googleConfigured } from "@/lib/oauth";

// Env Google dibaca saat request, bukan saat build — supaya tombol Google
// muncul/hilang cukup dengan restart server.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentUser()) redirect("/dashboard");

  return (
    <div>
      <WordReveal text="Selamat datang kembali" className="text-2xl font-semibold text-white" />
      <p className="mt-1 mb-6 text-sm text-slate-400">Lanjutkan PRD yang belum selesai.</p>
      <Suspense fallback={<div className="h-52 animate-pulse rounded-xl bg-slate-900/50" />}>
        <AuthForm mode="login" googleEnabled={googleConfigured()} />
      </Suspense>
      <p className="mt-6 text-center text-sm text-slate-400">
        Belum punya akun?{" "}
        <Link href="/register" className="text-[#35d6ff] hover:underline">
          Daftar gratis
        </Link>
      </p>
    </div>
  );
}
