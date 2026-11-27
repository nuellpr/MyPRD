"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Field } from "@/components/auth/Field";
import { SubmitButton, type SubmitStatus } from "@/components/auth/SubmitButton";
import { IconLock, IconMail, IconUser } from "@/components/icons";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { scorePassword } from "@/lib/password-strength";

/** Hanya izinkan redirect ke path lokal — tolak "//evil.com" (protocol-relative). */
function safeNext(value: string | null): string | null {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

const STRENGTH_META = [
  { label: "Terlalu lemah", color: "bg-rose-500" },
  { label: "Lemah", color: "bg-amber-500" },
  { label: "Cukup", color: "bg-yellow-400" },
  { label: "Kuat", color: "bg-sky-400" },
  { label: "Sangat kuat", color: "bg-emerald-400" },
] as const;

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.2-1.4 3.6-5.4 3.6-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12Z"
      />
      <path
        fill="#4285F4"
        d="M21.4 12.2c0-.6-.1-1.1-.2-1.6H12v3.9h5.4c-.3 1.3-1.1 2.4-2.3 3.1l3.6 2.8c2.1-1.9 2.7-4.8 2.7-8.2Z"
      />
      <path
        fill="#FBBC05"
        d="M6.1 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L2.5 7C1.8 8.5 1.4 10.2 1.4 12s.4 3.5 1.1 5l3.6-2.7Z"
      />
      <path
        fill="#34A853"
        d="M12 21.8c2.7 0 5-.9 6.6-2.4l-3.6-2.8c-.9.6-2 .9-3 .9-2.4 0-4.4-1.6-5.1-3.8l-3.6 2.7c1.6 3.2 4.9 5.4 8.7 5.4Z"
      />
    </svg>
  );
}

export function AuthForm({ mode, googleEnabled }: { mode: "login" | "register"; googleEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduced = useReducedMotion();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");

  const isRegister = mode === "register";
  const nextParam = safeNext(searchParams.get("next"));
  const googleHref = `/api/auth/google${nextParam ? `?next=${encodeURIComponent(nextParam)}` : ""}`;
  const oauthParam = searchParams.get("oauth");
  const oauthFailed = oauthParam === "gagal";
  const oauthLocked = oauthParam === "locked";
  const strength = isRegister ? scorePassword(password) : 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitStatus("loading");
    try {
      const res = await fetch(`/api/auth/${isRegister ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRegister ? { email, password, name } : { email, password }),
      });
      const data = (await res.json()) as {
        error?: string;
        devCode?: string;
        requires2fa?: boolean;
        email?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Terjadi kesalahan.");
        setShakeKey((k) => k + 1);
        setSubmitStatus("idle");
        return;
      }
      setSubmitStatus("success");
      if (isRegister) {
        const params = new URLSearchParams({ email, purpose: "register" });
        if (nextParam) params.set("next", nextParam);
        if (data.devCode) params.set("devCode", data.devCode);
        router.push(`/verifikasi-otp?${params.toString()}`);
      } else if (data.requires2fa) {
        const params = new URLSearchParams({ email: data.email || email, purpose: "2fa" });
        if (nextParam) params.set("next", nextParam);
        if (data.devCode) params.set("devCode", data.devCode);
        router.push(`/verifikasi-otp?${params.toString()}`);
      } else {
        router.push(nextParam ?? "/dashboard");
      }
      router.refresh();
    } catch {
      setError("Tidak bisa menghubungi server.");
      setShakeKey((k) => k + 1);
      setSubmitStatus("idle");
    }
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      animate={shakeKey > 0 && !reduced ? { x: [0, -6, 6, -4, 4, 0] } : undefined}
      transition={{ duration: 0.35 }}
    >
      <Stagger inView={false} className="space-y-4">
        {isRegister ? (
          <StaggerItem>
            <Field
              id="name"
              label="Nama (opsional)"
              value={name}
              onChange={setName}
              autoComplete="name"
              icon={<IconUser className="h-4 w-4" />}
            />
          </StaggerItem>
        ) : null}

        <StaggerItem>
          <Field
            id="email"
            label="Email"
            type="email"
            required
            value={email}
            onChange={setEmail}
            autoComplete="email"
            icon={<IconMail className="h-4 w-4" />}
          />
        </StaggerItem>

        <StaggerItem>
          <Field
            id="password"
            label="Password"
            type="password"
            required
            minLength={isRegister ? 8 : undefined}
            value={password}
            onChange={setPassword}
            autoComplete={isRegister ? "new-password" : "current-password"}
            icon={<IconLock className="h-4 w-4" />}
          />

          {isRegister && password.length > 0 ? (
            <div className="mt-2">
              <div className="grid grid-cols-4 gap-1.5">
                {[0, 1, 2, 3].map((idx) => {
                  const active = idx < strength;
                  return (
                    <span key={idx} className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <motion.span
                        initial={false}
                        animate={{ scaleX: active ? 1 : 0 }}
                        transition={{ duration: reduced ? 0.01 : 0.25 }}
                        className={`block h-full w-full origin-left rounded-full ${STRENGTH_META[strength].color}`}
                      />
                    </span>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Kekuatan password: <span className="text-slate-200">{STRENGTH_META[strength].label}</span>
              </p>
            </div>
          ) : null}

          {!isRegister ? (
            <Link href="/lupa-password" className="mt-2 inline-block text-xs text-[#35d6ff] hover:underline">
              Lupa password?
            </Link>
          ) : null}
        </StaggerItem>

        <AnimatePresence>
          {error || oauthFailed || oauthLocked ? (
            <motion.p
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            >
              {error ||
                (oauthLocked
                  ? "Verifikasi 2FA dikunci 24 jam karena gagal 5 kali berturut-turut."
                  : "Login Google gagal atau dibatalkan. Coba lagi.")}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <StaggerItem>
          <SubmitButton
            status={submitStatus}
            idleLabel={isRegister ? "Buat akun gratis" : "Masuk"}
            successLabel={isRegister ? "Kode terkirim" : "Masuk berhasil"}
          />
        </StaggerItem>

        {googleEnabled ? (
          <StaggerItem className="space-y-4">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="h-px flex-1 bg-slate-800" />
              atau
              <span className="h-px flex-1 bg-slate-800" />
            </div>
            <a
              href={googleHref}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-700/80 bg-[#060912]/80 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-900"
            >
              <GoogleLogo />
              <span>Lanjutkan dengan Google</span>
            </a>
          </StaggerItem>
        ) : null}
      </Stagger>
    </motion.form>
  );
}
