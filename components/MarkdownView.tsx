"use client";

import type { ReactNode } from "react";
import { isValidElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidDiagram } from "./workspace/MermaidDiagram";

export interface MarkdownHeading {
  level: 2 | 3;
  text: string;
  id: string;
}

/** Konversi judul heading markdown menjadi slug HTML stabil untuk anchor & TOC. */
export function slugifyHeading(text: string): string {
  const clean = text
    .toLowerCase()
    .replace(/[`*_~()[\]{}]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-");
  return clean || "bagian";
}

/** Ekstrak heading H2 & H3 dari markdown untuk daftar isi (TOC) Wiki PRD. */
export function extractHeadings(markdown: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  const seen = new Set<string>();
  let inFence = false;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = trimmed.match(/^(#{2,3})\s+(.+)$/);
    if (!match) continue;
    const level = match[1].length as 2 | 3;
    const text = match[2].replace(/\s+#*$/, "").trim();
    const id = slugifyHeading(text);
    if (seen.has(id)) continue;
    seen.add(id);
    headings.push({ level, text, id });
  }
  return headings;
}

function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return nodeText(node.props.children);
  }
  return "";
}

export function MarkdownView({
  content,
  className,
  renderMermaid = true,
}: {
  content: string;
  className?: string;
  renderMermaid?: boolean;
}) {
  return (
    <div className={`prd-preview text-sm text-slate-200 ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2({ children }) {
            return (
              <h2 id={slugifyHeading(nodeText(children))} className="scroll-mt-20">
                {children}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 id={slugifyHeading(nodeText(children))} className="scroll-mt-20">
                {children}
              </h3>
            );
          },
          pre({ children }) {
            if (isValidElement<{ className?: string; children?: ReactNode }>(children)) {
              const cls = children.props.className ?? "";
              if (cls.includes("language-mermaid")) {
                const rawCode = nodeText(children.props.children);
                if (!renderMermaid) {
                  return (
                    <div className="my-3 rounded-xl border border-slate-800 bg-[#070a14] p-3">
                      <p className="mb-1.5 text-[11px] font-medium text-[#7fe3ff]">
                        Diagram Mermaid (sedang disusun…)
                      </p>
                      <pre className="m-0 overflow-x-auto bg-transparent p-0 font-mono text-xs text-slate-300">
                        <code>{rawCode}</code>
                      </pre>
                    </div>
                  );
                }
                return <MermaidDiagram code={rawCode} />;
              }
            }
            return <pre>{children}</pre>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
