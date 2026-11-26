"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

export interface FaqItem {
  q: string;
  a: string;
}

export function Faq({ items }: { items: FaqItem[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const reduced = useReducedMotion();

  return (
    <div className="mt-8 space-y-3">
      {items.map((item, idx) => {
        const isOpen = openIdx === idx;
        return (
          <div
            key={item.q}
            className="card-lift rounded-2xl border border-slate-800/90 bg-[#0a0f20]/75 transition hover:border-[#4f7cff]/40"
          >
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpenIdx(isOpen ? null : idx)}
              className="flex w-full items-center justify-between gap-4 p-5 text-left"
            >
              <span className="font-medium text-slate-100">{item.q}</span>
              <motion.span
                aria-hidden
                animate={reduced ? undefined : { rotate: isOpen ? 45 : 0 }}
                transition={{ duration: 0.2 }}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-slate-700 text-sm text-[#35d6ff]"
              >
                +
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: reduced ? 0.01 : 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <p className="px-5 pb-5 text-sm leading-relaxed text-slate-400">{item.a}</p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
