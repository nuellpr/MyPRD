import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function RegisterPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
        <h1 className="text-2xl font-semibold">Bikin akun MyPRD</h1>
        <p className="mt-1 mb-6 text-sm text-slate-400">
          Gratis, langsung dapat kuota generate PRD bulanan.
        </p>
        <AuthForm mode="register" />
        <p className="mt-6 text-center text-sm text-slate-400">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-sky-400 hover:underline">
            Masuk
          </Link>
        </p>
      </div>
    </main>
  );
}
