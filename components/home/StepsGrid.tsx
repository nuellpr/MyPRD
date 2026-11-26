"use client";

import { motion, useReducedMotion } from "motion/react";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";

export interface StepItem {
  title: string;
  body: string;
}

export function StepsGrid({ steps }: { steps: StepItem[] }) {
  const reduced = useReducedMotion();

  return (
    <div className="relative mt-10">
      <div aria-hidden className="pointer-events-none absolute top-9 right-16 left-16 hidden h-px md:block">
        <motion.div
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: reduced ? 0.01 : 0.85, ease: [0.22, 1, 0.36, 1] }}
          className="h-full origin-left bg-linear-to-r from-[#4f7cff]/60 via-[#35d6ff]/70 to-[#a78bfa]/60"
        />
      </div>

      <Stagger className="grid gap-5 md:grid-cols-3">
        {steps.map((step, index) => (
          <StaggerItem
            key={step.title}
            className="card-lift relative rounded-2xl border border-slate-800/90 bg-[#0b1020]/80 p-6 backdrop-blur-xs"
          >
            <span className="mb-3 inline-grid h-7 w-7 place-items-center rounded-full border border-[#35d6ff]/40 bg-[#060912] text-xs font-bold text-[#35d6ff]">
              {index + 1}
            </span>
            <h3 className="font-semibold text-sky-300">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{step.body}</p>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
