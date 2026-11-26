import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { IconSparkles } from "@/components/icons";
import { googleConfigured } from "@/lib/oauth";

// Env Google dibaca saat request, bukan saat build — supaya tombol Google
// muncul/hilang cukup dengan restart server.
export const dynamic = "force-dynamic";

export default function LoginPage() {
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
          <h1 className="auth-field text-2xl font-semibold">Masuk ke MyPRD</h1>
          <p className="auth-field mt-1 mb-6 text-sm text-slate-400">Lanjutkan PRD yang belum selesai.</p>
          <AuthForm mode="login" googleEnabled={googleConfigured()} />
          <p className="auth-field mt-6 text-center text-sm text-slate-400">
            Belum punya akun?{" "}
            <Link href="/register" className="text-sky-400 hover:underline">
              Daftar gratis
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
