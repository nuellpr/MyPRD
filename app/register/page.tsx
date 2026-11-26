import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { IconSparkles } from "@/components/icons";
import { googleConfigured } from "@/lib/oauth";

// Lihat catatan di app/login/page.tsx.
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <div className="auth-shell flex flex-1 flex-col justify-center px-4 py-16">
      <main className="mx-auto w-full max-w-md">
        <div className="auth-card rounded-2xl border border-slate-800 bg-slate-900/40 p-8 backdrop-blur">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-300">
              <IconSparkles className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-wide text-slate-200">MyPRD</span>
          </div>
          <h1 className="auth-field text-2xl font-semibold">Bikin akun MyPRD</h1>
          <p className="auth-field mt-1 mb-6 text-sm text-slate-400">
            Gratis, langsung dapat kuota generate PRD bulanan.
          </p>
          <AuthForm mode="register" googleEnabled={googleConfigured()} />
          <p className="auth-field mt-6 text-center text-sm text-slate-400">
            Sudah punya akun?{" "}
            <Link href="/login" className="text-sky-400 hover:underline">
              Masuk
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
