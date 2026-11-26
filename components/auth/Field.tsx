"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState, type ReactNode } from "react";

interface FieldProps {
  id: string;
  label: string;
  type?: "text" | "email" | "password";
  value: string;
  onChange: (next: string) => void;
  icon: ReactNode;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  readOnly?: boolean;
  hint?: string;
}

export function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  icon,
  autoComplete,
  required,
  minLength,
  readOnly,
  hint,
}: FieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  const reduced = useReducedMotion();
  const isPassword = type === "password";
  const effectiveType = isPassword ? (showPassword ? "text" : "password") : type;

  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400 transition-colors">
          {icon}
        </span>

        <input
          id={id}
          type={effectiveType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          readOnly={readOnly}
          placeholder=" "
          className={`peer w-full rounded-xl border border-slate-700/80 bg-[#060912]/90 pt-5 pb-2 pl-10 ${
            isPassword ? "pr-11" : "pr-3.5"
          } text-sm text-slate-100 outline-none transition focus:border-[#35d6ff] focus:shadow-[0_0_0_3px_rgba(53,214,255,0.16)] ${
            readOnly ? "cursor-not-allowed opacity-75" : ""
          }`}
        />

        <label
          htmlFor={id}
          className="pointer-events-none absolute top-2 left-10 origin-left text-[11px] font-medium text-slate-400 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:text-slate-400 peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:font-medium peer-focus:text-[#35d6ff]"
        >
          {label}
        </label>

        {isPassword ? (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-pressed={showPassword}
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            className="absolute top-1/2 right-2.5 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-800/80 hover:text-slate-100"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
              <motion.path
                d="M4 4 20 20"
                initial={false}
                animate={{ pathLength: showPassword ? 0 : 1, opacity: showPassword ? 0 : 1 }}
                transition={{ duration: reduced ? 0.01 : 0.2 }}
              />
            </svg>
          </button>
        ) : null}
      </div>

      {hint ? <p className="mt-1.5 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}
