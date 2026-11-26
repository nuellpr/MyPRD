"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { IconLock, IconMail, IconUser } from "@/components/icons";

/** Hanya izinkan redirect ke path lokal — tolak "//evil.com" (protocol-relative). */
function safeNext(value: string | null): string | null {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

export function AuthForm({ mode, googleEnabled }: { mode: "login" | "register"; googleEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";
  const nextParam = safeNext(searchParams.get("next"));
  const googleHref = `/api/auth/google${nextParam ? `?next=${encodeURIComponent(nextParam)}` : ""}`;
  const oauthFailed = searchParams.get("oauth") === "gagal";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${isRegister ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRegister ? { email, password, name } : { email, password }),
      });
      const data = (await res.json()) as { error?: string; devCode?: string };
      if (!res.ok) {
        setError(data.error ?? "Terjadi kesalahan.");
        return;
      }
      if (isRegister) {
        const params = new URLSearchParams({ email, purpose: "register" });
        if (nextParam) params.set("next", nextParam);
        if (data.devCode) params.set("devCode", data.devCode);
        router.push(`/verifikasi-otp?${params.toString()}`);
      } else {
        router.push(nextParam ?? "/dashboard");
      }
      router.refresh();
    } catch {
      setError("Tidak bisa menghubungi server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isRegister ? (
        <div className="auth-field">
          <label className="mb-1 block text-sm text-slate-300" htmlFor="name">
            Nama (opsional)
          </label>
          <div className="relative">
            <IconUser className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-sky-500"
              placeholder="Nama kamu"
            />
          </div>
        </div>
      ) : null}

      <div className="auth-field">
        <label className="mb-1 block text-sm text-slate-300" htmlFor="email">
          Email
        </label>
        <div className="relative">
          <IconMail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-sky-500"
            placeholder="nama@email.com"
          />
        </div>
      </div>

      <div className="auth-field">
        <label className="mb-1 block text-sm text-slate-300" htmlFor="password">
          Password
        </label>
        <div className="relative">
          <IconLock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            id="password"
            type="password"
            required
            minLength={isRegister ? 8 : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-sky-500"
            placeholder={isRegister ? "Minimal 8 karakter" : "Password kamu"}
          />
        </div>
        {!isRegister ? (
          <Link href="/lupa-password" className="mt-1.5 inline-block text-xs text-sky-400 hover:underline">
            Lupa password?
          </Link>
        ) : null}
      </div>

      {error || oauthFailed ? (
        <p className="auth-field rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error || "Login Google gagal atau dibatalkan. Coba lagi."}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="auth-field w-full rounded-lg bg-linear-to-r from-sky-500 to-violet-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-60"
      >
        {loading ? "Memproses..." : isRegister ? "Buat akun gratis" : "Masuk"}
      </button>

      {googleEnabled ? (
        <>
          <div className="auth-field flex items-center gap-3 text-xs text-slate-500">
            <span className="h-px flex-1 bg-slate-800" />
            atau
            <span className="h-px flex-1 bg-slate-800" />
          </div>
          <a
            href={googleHref}
            className="auth-field block w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-center text-sm font-semibold text-slate-100 transition hover:border-slate-500"
          >
            Lanjutkan dengan Google
          </a>
        </>
      ) : null}
    </form>
  );
}
