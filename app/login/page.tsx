import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { googleConfigured } from "@/lib/oauth";

// Env Google dibaca saat request, bukan saat build — supaya tombol Google
// muncul/hilang cukup dengan restart server.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
        <h1 className="text-2xl font-semibold">Masuk ke MyPRD</h1>
        <p className="mt-1 mb-6 text-sm text-slate-400">Lanjutkan PRD yang belum selesai.</p>
        <AuthForm mode="login" googleEnabled={googleConfigured()} />
        <p className="mt-6 text-center text-sm text-slate-400">
          Belum punya akun?{" "}
          <Link href="/register" className="text-sky-400 hover:underline">
            Daftar gratis
          </Link>
        </p>
      </div>
    </main>
  );
}
