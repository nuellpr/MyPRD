"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { OtpInput } from "@/components/OtpInput";
import { IconArrowRight, IconCheck, IconSparkles } from "@/components/icons";

function VerifikasiForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const purpose = params.get("purpose") === "google" || params.get("purpose") === "reset" ? params.get("purpose")! : "register";
  const devCode = params.get("devCode") ?? "";
  const nextParam = params.get("next");
  const safeNext = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;

  const [code, setCode] = useState(devCode);
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function verify() {
    setError("");
    setStatus("idle");
    if (code.length !== 6) {
      setError("Masukkan 6 digit kode OTP.");
      setStatus("error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, purpose }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Kode tidak valid.");
      setStatus("success");
      router.push(safeNext ?? "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memverifikasi.");
      setStatus("error");
      setLoading(false);
    }
  }

  async function resend() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { devCode?: string };
      if (data.devCode) setCode(data.devCode);
      setError("Kode baru sudah dikirim ke emailmu.");
    } catch {
      setError("Gagal mengirim ulang kode. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

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
          <h1 className="auth-field text-2xl font-semibold">Verifikasi kode OTP</h1>
          <p className="auth-field mt-1 mb-6 text-sm text-slate-400">
            Kode 6 digit sudah dikirim ke <span className="text-slate-200">{email || "emailmu"}</span>. Berlaku 10 menit.
          </p>
          <div className="auth-field">
            <OtpInput value={code} onChange={setCode} status={status} />
          </div>
          {devCode && (
            <p className="auth-field mt-3 text-center text-xs text-slate-500">
              Mode dev — kode: <span className="font-mono text-sky-300">{devCode}</span>
            </p>
          )}
          {error && <p className="auth-field mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
          {status === "success" && (
            <p className="auth-field mt-4 flex items-center justify-center gap-1.5 text-sm text-emerald-300">
              <IconCheck className="h-4 w-4" /> Terverifikasi
            </p>
          )}
          <button
            type="button"
            onClick={verify}
            disabled={loading || status === "success"}
            className="btn-shine auth-field mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-linear-to-r from-sky-500 to-violet-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Memproses..." : "Verifikasi"}
            {!loading && <IconArrowRight className="h-4 w-4" />}
          </button>
          <div className="auth-field mt-5 flex items-center justify-between text-xs text-slate-400">
            <button type="button" onClick={resend} disabled={loading} className="hover:text-sky-300 hover:underline disabled:opacity-60">
              Kirim ulang kode
            </button>
            <Link href="/login" className="hover:text-sky-300 hover:underline">
              Kembali ke masuk
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function VerifikasiOtpPage() {
  return (
    <Suspense fallback={<div className="auth-shell flex flex-1 items-center justify-center text-slate-400">Memuat...</div>}>
      <VerifikasiForm />
    </Suspense>
  );
}
