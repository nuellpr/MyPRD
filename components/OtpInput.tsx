"use client";

import { useRef } from "react";

type Status = "idle" | "error" | "success";

/** Enam kotak OTP dengan auto-advance, backspace, paste, dan animasi. */
export function OtpInput({
  value,
  onChange,
  status = "idle",
}: {
  value: string;
  onChange: (next: string) => void;
  status?: Status;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");
  const statusClass = status === "error" ? "otp-shake" : status === "success" ? "otp-success" : "";

  function setDigit(index: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join("").replace(/\s/g, ""));
    if (digit && index < 5) refs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) refs.current[index - 1]?.focus();
    if (e.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) refs.current[index + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  }

  return (
    <div className={`flex justify-center gap-2 sm:gap-3 ${statusClass}`} onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          aria-label={`Digit ${i + 1}`}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digit}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={`otp-box h-14 w-11 rounded-xl border bg-slate-950 text-center text-2xl font-semibold text-white outline-none transition sm:w-12 ${
            digit ? "otp-pop" : ""
          } ${status === "error" ? "border-red-500" : status === "success" ? "border-emerald-400" : "border-slate-700 focus:border-sky-400 focus:shadow-[0_0_0_3px_rgba(53,214,255,0.15)]"}`}
        />
      ))}
    </div>
  );
}
