"use client";

import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const staggerContainerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: EASE },
  },
};

type Tag = "div" | "ul" | "ol" | "li" | "section" | "article";

const MOTION_TAGS = {
  div: motion.div,
  ul: motion.ul,
  ol: motion.ol,
  li: motion.li,
  section: motion.section,
  article: motion.article,
} as const;

export function Stagger({
  children,
  as = "div",
  className = "",
  inView = true,
}: {
  children: ReactNode;
  as?: Tag;
  className?: string;
  inView?: boolean;
}) {
  const Component = MOTION_TAGS[as];
  if (inView) {
    return (
      <Component
        variants={staggerContainerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
        className={className}
      >
        {children}
      </Component>
    );
  }
  return (
    <Component variants={staggerContainerVariants} initial="hidden" animate="show" className={className}>
      {children}
    </Component>
  );
}

export function StaggerItem({
  children,
  as = "div",
  className = "",
}: {
  children: ReactNode;
  as?: Tag;
  className?: string;
}) {
  const Component = MOTION_TAGS[as];
  return (
    <Component variants={staggerItemVariants} className={className}>
      {children}
    </Component>
  );
}

export function WordReveal({
  text,
  highlightWords,
  highlightClassName = "text-shimmer bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] bg-clip-text text-transparent",
  className = "",
  as = "h1",
}: {
  text: string;
  highlightWords?: string[];
  highlightClassName?: string;
  className?: string;
  as?: "h1" | "h2" | "p" | "span";
}) {
  const words = text.split(" ");
  const highlights = new Set((highlightWords ?? []).map((w) => w.toLowerCase()));
  const Tag = as;

  return (
    <Tag className={className}>
      {words.map((word, idx) => {
        const clean = word.replace(/[.,!?]/g, "").toLowerCase();
        const isHighlight = highlights.has(clean);
        return (
          <motion.span
            key={`${word}-${idx}`}
            initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.42, delay: idx * 0.045, ease: EASE }}
            className={`inline-block ${isHighlight ? highlightClassName : ""}`}
          >
            {word}
            {idx < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        );
      })}
    </Tag>
  );
}
