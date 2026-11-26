"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";

type Status = "idle" | "error" | "success";

/** Enam kotak OTP dengan auto-advance, backspace, paste, auto-complete, dan animasi. */
export function OtpInput({
  value,
  onChange,
  onComplete,
  status = "idle",
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  status?: Status;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const reduced = useReducedMotion();

  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");
  const statusClass = status === "error" ? "otp-shake" : status === "success" ? "otp-success" : "";

  function commit(nextCode: string) {
    onChange(nextCode);
    if (nextCode.length === 6 && onComplete) {
      onComplete(nextCode);
    }
  }

  function setDigit(index: number, raw: string) {
    const cleaned = raw.replace(/\D/g, "");
    if (cleaned.length > 1) {
      const pasted = cleaned.slice(0, 6);
      commit(pasted);
      refs.current[Math.min(pasted.length, 5)]?.focus();
      return;
    }
    const digit = cleaned.slice(-1);
    const next = digits.slice();
    next[index] = digit;
    const joined = next.join("").replace(/\s/g, "");
    commit(joined);
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
    commit(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  }

  return (
    <div className={`flex justify-center gap-2 sm:gap-3 ${statusClass}`} onPaste={handlePaste}>
      {digits.map((digit, i) => {
        const isFocused = focusedIndex === i;
        const borderClass =
          status === "error"
            ? "border-red-500 bg-red-500/10"
            : status === "success"
              ? "otp-wave border-emerald-400 bg-emerald-500/10"
              : digit
                ? "border-[#35d6ff]/80 bg-[#0d1630]"
                : "border-slate-700/80 bg-[#060912]";

        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0.01 : 0.25, delay: reduced ? 0 : i * 0.05 }}
            className="relative"
          >
            <input
              ref={(el) => {
                refs.current[i] = el;
              }}
              aria-label={`Digit ${i + 1}`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              value={digit}
              onFocus={() => setFocusedIndex(i)}
              onBlur={() => setFocusedIndex((prev) => (prev === i ? null : prev))}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              style={status === "success" ? ({ "--i": i } as React.CSSProperties) : undefined}
              className={`otp-box h-14 w-11 rounded-xl border text-center text-2xl font-semibold text-white outline-none transition sm:w-12 ${
                digit ? "otp-pop" : ""
              } ${borderClass} ${
                isFocused && status === "idle"
                  ? "border-[#35d6ff] shadow-[0_0_0_3px_rgba(53,214,255,0.18)]"
                  : ""
              }`}
            />
            {isFocused && !digit ? (
              <span
                aria-hidden
                className="caret-blink pointer-events-none absolute top-1/2 left-1/2 h-6 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#35d6ff]"
              />
            ) : null}
          </motion.div>
        );
      })}
    </div>
  );
}
