"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field } from "@/components/auth/Field";
import { SubmitButton, type SubmitStatus } from "@/components/auth/SubmitButton";
import { IconCheck, IconLock, IconMail } from "./icons";
import { OtpInput } from "./OtpInput";

interface Props {
  mode: "forgot" | "reset";
  email?: string;
  devCode?: string;
}

export function PasswordRecoveryForm({ mode, email: initialEmail = "", devCode: initialCode = "" }: Props) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState(initialCode);
  const [password, setPassword] = useState("");
  const [otpStatus, setOtpStatus] = useState<"idle" | "error" | "success">("idle");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [devCode, setDevCode] = useState("");
  const isForgot = mode === "forgot";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitStatus("loading");
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
      setSubmitStatus("success");
      if (isForgot) {
        setDone(true);
        if (data.devCode) setDevCode(data.devCode);
      } else {
        setOtpStatus("success");
        router.push("/login?reset=1");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal. Coba lagi sebentar.");
      setSubmitStatus("idle");
    }
  }

  return (
    <div>
      {/* Step indicator */}
      <div className="mb-5 flex items-center gap-2 text-xs">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
            isForgot && !done
              ? "border border-[#35d6ff]/50 bg-[#35d6ff]/15 text-[#7fe3ff]"
              : "border border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
          }`}
        >
          <span>1.</span> Email
        </span>
        <span className="h-px flex-1 bg-slate-800">
          <motion.span
            initial={false}
            animate={{ scaleX: isForgot && !done ? 0.35 : 1 }}
            transition={{ duration: reduced ? 0.01 : 0.35 }}
            className="block h-full origin-left bg-linear-to-r from-[#4f7cff] to-[#35d6ff]"
          />
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
            !isForgot
              ? "border border-[#35d6ff]/50 bg-[#35d6ff]/15 text-[#7fe3ff]"
              : "border border-slate-800 bg-slate-900/60 text-slate-400"
          }`}
        >
          <span>2.</span> Kode & password baru
        </span>
      </div>

      <h1 className="text-2xl font-semibold text-white">{isForgot ? "Lupa password?" : "Password baru"}</h1>
      <p className="mt-1 mb-6 text-sm text-slate-400">
        {isForgot
          ? "Masukkan email akunmu. Kami kirim kode 6 digit yang berlaku 10 menit."
          : "Masukkan kode OTP dari email dan password baru minimal 8 karakter."}
      </p>

      {done ? (
        <div className="space-y-4">
          <p className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300">
            <IconCheck className="h-4 w-4 shrink-0" /> Jika email terdaftar, kode OTP sudah dikirim.
          </p>
          {devCode ? (
            <p className="break-all rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Mode dev — kode: <span className="font-mono">{devCode}</span>.{" "}
              <Link
                className="font-medium underline"
                href={`/reset-password?email=${encodeURIComponent(email)}&devCode=${encodeURIComponent(devCode)}`}
              >
                Lanjut ganti password →
              </Link>
            </p>
          ) : null}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            id="recovery-email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            readOnly={!isForgot}
            required
            icon={<IconMail className="h-4 w-4" />}
          />

          {!isForgot ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-400">Kode OTP 6 digit</p>
              <OtpInput value={code} onChange={setCode} status={otpStatus} />
            </div>
          ) : null}

          {!isForgot ? (
            <Field
              id="recovery-password"
              label="Password baru"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              minLength={8}
              required
              icon={<IconLock className="h-4 w-4" />}
            />
          ) : null}

          {!isForgot && initialCode ? (
            <p className="text-center text-xs text-slate-500">
              Mode dev — kode: <span className="font-mono text-[#35d6ff]">{initialCode}</span>
            </p>
          ) : null}

          <AnimatePresence>
            {error ? (
              <motion.p
                role="alert"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
              >
                {error}
              </motion.p>
            ) : null}
          </AnimatePresence>

          <SubmitButton
            status={submitStatus}
            idleLabel={isForgot ? "Kirim kode OTP" : "Simpan password baru"}
            successLabel={isForgot ? "Terkirim" : "Password tersimpan"}
          />
        </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-400">
        <Link href="/login" className="text-[#35d6ff] hover:underline">
          Kembali ke masuk
        </Link>
      </p>
    </div>
  );
}
