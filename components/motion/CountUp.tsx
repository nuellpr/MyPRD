"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

export function CountUp({
  value,
  compact = false,
  className = "",
}: {
  value: number;
  compact?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduced = useReducedMotion();

  const formatter = new Intl.NumberFormat("id-ID", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  });

  const formattedFinal = formatter.format(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced || !inView || value <= 0) {
      el.textContent = formatter.format(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        if (ref.current) {
          ref.current.textContent = formatter.format(Math.round(latest));
        }
      },
      onComplete: () => {
        if (ref.current) {
          ref.current.textContent = formatter.format(value);
        }
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, compact, inView, reduced]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {formattedFinal}
    </span>
  );
}
