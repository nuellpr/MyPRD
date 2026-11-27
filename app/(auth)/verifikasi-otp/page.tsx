"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { OtpInput } from "@/components/OtpInput";
import { SubmitButton, type SubmitStatus } from "@/components/auth/SubmitButton";

const BURST_DOTS = [
  { x: 0, y: -32 },
  { x: 23, y: -23 },
  { x: 32, y: 0 },
  { x: 23, y: 23 },
  { x: 0, y: 32 },
  { x: -23, y: 23 },
  { x: -32, y: 0 },
  { x: -23, y: -23 },
];

const COOLDOWN_SEC = 60;
const RING_R = 9;
const RING_C = 2 * Math.PI * RING_R;

function VerifikasiForm() {
  const router = useRouter();
  const params = useSearchParams();
  const reduced = useReducedMotion();

  const email = params.get("email") ?? "";
  const rawPurpose = params.get("purpose");
  const purpose =
    rawPurpose === "google" || rawPurpose === "reset" || rawPurpose === "2fa" ? rawPurpose : "register";
  const is2fa = purpose === "2fa";
  const method = params.get("method") === "totp" ? "totp" : "email";
  const isTotp = is2fa && method === "totp";
  const initialDevCode = params.get("devCode") ?? "";
  const nextParam = params.get("next");
  const safeNext = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;

  const [code, setCode] = useState(initialDevCode);
  const [devCode, setDevCode] = useState(initialDevCode);
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [cooldown, setCooldown] = useState(COOLDOWN_SEC);
  const [resending, setResending] = useState(false);

  const verifyingRef = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const verify = useCallback(
    async (codeArg?: string) => {
      if (verifyingRef.current || status === "success") return;
      const targetCode = (codeArg ?? code).trim();
      setError("");
      setInfo("");
      setStatus("idle");

      if (targetCode.length !== 6) {
        setError("Masukkan 6 digit kode OTP.");
        setStatus("error");
        return;
      }

      verifyingRef.current = true;
      setSubmitStatus("loading");
      try {
        const res = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: targetCode, purpose }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Kode tidak valid.");
        setStatus("success");
        setSubmitStatus("success");
        const delay = reduced ? 0 : 900;
        window.setTimeout(() => {
          router.push(safeNext ?? "/dashboard");
          router.refresh();
        }, delay);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memverifikasi.");
        setStatus("error");
        setSubmitStatus("idle");
      } finally {
        verifyingRef.current = false;
      }
    },
    [code, email, purpose, reduced, router, safeNext, status],
  );

  async function resend() {
    if (cooldown > 0 || resending || status === "success") return;
    setError("");
    setInfo("");
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose }),
      });
      const data = (await res.json().catch(() => ({}))) as { devCode?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Gagal mengirim ulang kode. Coba lagi.");
        setStatus("error");
        return;
      }
      if (data.devCode) {
        setDevCode(data.devCode);
        setCode(data.devCode);
      }
      setInfo("Kode baru sudah dikirim ke emailmu.");
      setCooldown(COOLDOWN_SEC);
    } catch {
      setError("Gagal mengirim ulang kode. Coba lagi.");
    } finally {
      setResending(false);
    }
  }

  const dashOffset = RING_C * (1 - cooldown / COOLDOWN_SEC);

  return (
    <div>
      {/* Animated envelope / success celebration */}
      <div className="mb-5 flex justify-center pt-3">
        <div className="relative grid h-16 w-16 place-items-center">
          <AnimatePresence mode="wait">
            {status === "success" ? (
              <motion.div
                key="verified"
                initial={reduced ? { opacity: 1 } : { scale: 0.7, opacity: 0 }}
                animate={reduced ? { opacity: 1 } : { scale: 1, opacity: 1 }}
                className="relative grid h-16 w-16 place-items-center rounded-2xl border border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
              >
                <span aria-hidden className="ring-burst pointer-events-none absolute inset-0 rounded-2xl border border-emerald-400/60" />
                {!reduced
                  ? BURST_DOTS.map((dot, idx) => (
                      <motion.span
                        key={idx}
                        aria-hidden
                        initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                        animate={{ x: dot.x, y: dot.y, opacity: 0, scale: 0.2 }}
                        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                        className="pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-emerald-300"
                      />
                    ))
                  : null}
                <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2.4}>
                  <path d="M5 13l4 4L19 7" className="draw-check" />
                </svg>
              </motion.div>
            ) : (
              <motion.div
                key={isTotp ? "totp-shield" : "envelope"}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className="relative grid h-16 w-16 place-items-center rounded-2xl border border-[#35d6ff]/35 bg-[#35d6ff]/10 text-[#35d6ff]"
              >
                <span aria-hidden className="absolute inset-0 animate-ping rounded-2xl border border-[#35d6ff]/25 [animation-duration:2.6s]" />
                {isTotp ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="relative h-7 w-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                    <path d="m9.5 12 2 2 3.5-4" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="env-slide relative h-7 w-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <rect x="3" y="6" width="18" height="13" rx="2" />
                    <path d="m3 8 9 6 9-6" />
                  </svg>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <h1 className="text-center text-2xl font-semibold text-white">
        {is2fa ? "Verifikasi 2FA" : "Verifikasi kode OTP"}
      </h1>
      <p className="mt-1 text-center text-sm text-slate-400">
        {isTotp ? (
          <>
            Buka aplikasi Autentikator (Google Authenticator / Authy / 1Password) dan masukkan kode 6 digit untuk{" "}
            <span className="text-slate-200">{email || "akunmu"}</span>.
          </>
        ) : is2fa ? (
          <>
            Masukkan kode 2FA 6 digit yang dikirim ke <span className="text-slate-200">{email || "emailmu"}</span>.
            Berlaku 10 menit.
          </>
        ) : (
          <>
            Kode 6 digit sudah dikirim ke <span className="text-slate-200">{email || "emailmu"}</span>. Berlaku 10
            menit.
          </>
        )}
      </p>
      <p className="mt-1 mb-6 text-center text-xs text-slate-500">
        Gagal 5 kali berturut-turut akan mengunci verifikasi selama 24 jam.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
      >
        <OtpInput
          value={code}
          onChange={(next) => {
            setCode(next);
            if (status === "error") setStatus("idle");
          }}
          onComplete={(completed) => {
            void verify(completed);
          }}
          status={status}
        />

        {devCode ? (
          <p className="mt-3 text-center text-xs text-slate-500">
            Mode dev — kode: <span className="font-mono text-[#35d6ff]">{devCode}</span>
          </p>
        ) : null}

        <AnimatePresence>
          {error ? (
            <motion.p
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            >
              {error}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {info ? (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300"
            >
              {info}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <div className="mt-6">
          <SubmitButton status={submitStatus} idleLabel="Verifikasi" successLabel="Terverifikasi!" />
        </div>
      </form>

      <div className="mt-5 flex items-center justify-between text-xs text-slate-400">
        {!isTotp ? (
          <button
            type="button"
            onClick={() => void resend()}
            disabled={cooldown > 0 || resending || status === "success"}
            className="inline-flex items-center gap-2 transition hover:text-[#35d6ff] disabled:cursor-not-allowed disabled:opacity-65"
          >
            {cooldown > 0 ? (
              <>
                <svg viewBox="0 0 24 24" className="h-5 w-5 -rotate-90" aria-hidden="true">
                  <circle cx="12" cy="12" r={RING_R} fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="2.5" />
                  <circle
                    cx="12"
                    cy="12"
                    r={RING_R}
                    fill="none"
                    stroke="#35d6ff"
                    strokeWidth="2.5"
                    strokeDasharray={RING_C}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="tabular-nums">Kirim ulang ({cooldown}d)</span>
              </>
            ) : (
              <span className="hover:underline">{resending ? "Mengirim..." : "Kirim ulang kode"}</span>
            )}
          </button>
        ) : (
          <span className="text-slate-500">Kode berganti tiap 30 detik</span>
        )}

        <Link href="/login" className="hover:text-[#35d6ff] hover:underline">
          Kembali ke masuk
        </Link>
      </div>
    </div>
  );
}

export default function VerifikasiOtpPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-slate-400">Memuat...</div>}>
      <VerifikasiForm />
    </Suspense>
  );
}
