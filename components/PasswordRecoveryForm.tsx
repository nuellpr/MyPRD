"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OtpInput } from "./OtpInput";
import { IconArrowRight, IconCheck, IconLock, IconMail, IconSparkles } from "./icons";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-sky-500";

interface Props {
  mode: "forgot" | "reset";
  email?: string;
  devCode?: string;
}

export function PasswordRecoveryForm({ mode, email: initialEmail = "", devCode: initialCode = "" }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState(initialCode);
  const [password, setPassword] = useState("");
  const [otpStatus, setOtpStatus] = useState<"idle" | "error" | "success">("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [devCode, setDevCode] = useState("");
  const isForgot = mode === "forgot";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setDevCode("");
    setOtpStatus("idle");
    try {
      const res = await fetch(isForgot ? "/api/auth/forgot-password" : "/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isForgot ? { email } : { email, code, newPassword: password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; devCode?: string };
      if (!res.ok) {
        if (!isForgot) setOtpStatus("error");
        throw new Error(data.error || "Gagal. Coba lagi sebentar.");
      }
      if (isForgot) {
        setDone(true);
        if (data.devCode) setDevCode(data.devCode);
      } else {
        setOtpStatus("success");
        router.push("/login?reset=1");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal. Coba lagi sebentar.");
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
          <h1 className="auth-field text-2xl font-semibold">
            {isForgot ? "Lupa password?" : "Password baru"}
          </h1>
          <p className="auth-field mt-1 mb-6 text-sm text-slate-400">
            {isForgot
              ? "Masukkan email akunmu. Kami kirim kode 6 digit yang berlaku 10 menit."
              : "Masukkan kode OTP dari email dan password baru minimal 8 karakter."}
          </p>

          {done ? (
            <div className="space-y-4">
              <p className="inline-flex items-center gap-2 text-sm text-emerald-300">
                <IconCheck className="h-4 w-4" /> Jika email terdaftar, kode OTP sudah dikirim.
              </p>
              {devCode ? (
                <p className="break-all rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Mode dev — kode: <span className="font-mono">{devCode}</span>.{" "}
                  <Link
                    className="underline"
                    href={`/reset-password?email=${encodeURIComponent(email)}&devCode=${encodeURIComponent(devCode)}`}
                  >
                    Lanjut ganti password
                  </Link>
                </p>
              ) : null}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="auth-field relative">
                <IconMail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email"
                  autoComplete="email"
                  readOnly={!isForgot}
                  required
                  className={inputClass}
                />
              </div>
              {!isForgot ? (
                <div className="auth-field">
                  <OtpInput value={code} onChange={setCode} status={otpStatus} />
                </div>
              ) : null}
              {!isForgot ? (
                <div className="auth-field relative">
                  <IconLock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password baru"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    className={inputClass}
                  />
                </div>
              ) : null}
              {!isForgot && initialCode ? (
                <p className="auth-field text-center text-xs text-slate-500">
                  Mode dev — kode: <span className="font-mono text-sky-300">{initialCode}</span>
                </p>
              ) : null}
              {error ? (
                <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                className="btn-shine auth-field flex w-full items-center justify-center gap-1.5 rounded-lg bg-linear-to-r from-sky-500 to-violet-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-60"
              >
                {loading ? "Memproses..." : isForgot ? "Kirim kode OTP" : "Simpan password baru"}
                {!loading ? <IconArrowRight className="h-4 w-4" /> : null}
              </button>
            </form>
          )}

          <p className="auth-field mt-6 text-center text-sm text-slate-400">
            <Link href="/login" className="text-sky-400 hover:underline">
              Kembali ke masuk
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
