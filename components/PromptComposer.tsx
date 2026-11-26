"use client";

import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ModelOption } from "@/lib/model-options";
import { getTemplate, TEMPLATES } from "@/lib/templates";
import { DictationButton } from "./DictationButton";
import { IconArrowRight, IconBox, TemplateGlyph } from "./icons";

const PENDING_KEY = "myprd:pending-idea";
const WIZARD_REF_PENDING_KEY = "myprd:wizard-ref:pending";

export function wizardRefStorageKey(projectId: string) {
  return `myprd:wizard-ref:${projectId}`;
}

const EXAMPLES = [
  "Ceritakan ide aplikasimu, misalnya aplikasi booking barbershop…",
  "Ceritakan ide aplikasimu, misalnya aplikasi kasir warung kopi…",
  "Ceritakan ide aplikasimu, misalnya tracker keuangan pribadi…",
];

const SUGGESTION_CHIPS = [
  {
    label: "Booking barbershop",
    text: "Aplikasi booking jadwal barbershop dengan pilihan kapster, notifikasi WhatsApp, dan rekap omzet harian.",
  },
  {
    label: "Kasir warung kopi",
    text: "Aplikasi kasir POS untuk warung kopi kecil, dukung QRIS, stok bahan baku, dan laporan laba rugi mingguan.",
  },
  {
    label: "Tracker keuangan pribadi",
    text: "Aplikasi pencatat pengeluaran dan target tabungan bulanan dengan kategori otomatis dan grafik sederhana.",
  },
];

export function PromptComposer({
  authed,
  providers,
  defaultModel = "mock/default",
  variant,
}: {
  authed: boolean;
  providers?: ModelOption[];
  defaultModel?: string;
  variant: "hero" | "dashboard";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduced = useReducedMotion();

  const [idea, setIdea] = useState("");
  const [modelId, setModelId] = useState(defaultModel);
  const [language, setLanguage] = useState<"id" | "en">("id");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [referenceNote, setReferenceNote] = useState("");
  const [activePopover, setActivePopover] = useState<"plus" | "template" | "reference" | null>(null);
  const [error, setError] = useState("");
  const [pendingNotice, setPendingNotice] = useState(false);
  const [loading, setLoading] = useState(false);

  const [placeholder, setPlaceholder] = useState(EXAMPLES[0]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const [formScope, animateForm] = useAnimate();

  function triggerShake() {
    if (!reduced && formScope.current) {
      void animateForm(formScope.current, { x: [0, -6, 6, -4, 4, 0] }, { duration: 0.35 });
    }
  }

  // Typewriter placeholder loop (static when reduced motion or user typed).
  useEffect(() => {
    if (reduced || idea.length > 0) return;
    let idx = 0;
    let charIdx = EXAMPLES[0].length;
    let deleting = false;
    let timer: number;

    const step = () => {
      const target = EXAMPLES[idx];
      if (!deleting) {
        if (charIdx < target.length) {
          charIdx += 1;
          setPlaceholder(target.slice(0, charIdx));
          timer = window.setTimeout(step, 34);
        } else {
          deleting = true;
          timer = window.setTimeout(step, 2400);
        }
      } else {
        if (charIdx > 33) {
          charIdx -= 1;
          setPlaceholder(target.slice(0, charIdx));
          timer = window.setTimeout(step, 18);
        } else {
          deleting = false;
          idx = (idx + 1) % EXAMPLES.length;
          timer = window.setTimeout(step, 240);
        }
      }
    };

    timer = window.setTimeout(step, 2400);
    return () => window.clearTimeout(timer);
  }, [reduced, idea.length]);

  // Tutup popover saat klik di luar.
  useEffect(() => {
    if (!activePopover) return;
    const onPointerDown = (e: PointerEvent) => {
      if (composerRef.current && !composerRef.current.contains(e.target as Node)) {
        setActivePopover(null);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [activePopover]);

  // Prefill dari ?template=<slug>
  useEffect(() => {
    const slug = searchParams.get("template");
    if (!slug) return;
    const template = getTemplate(slug);
    if (!template) return;
    const timer = window.setTimeout(() => {
      setSelectedTemplate(template.name);
      setIdea((current) => (current.trim() ? current : `${template.ideaContext}\n\nIde saya: `));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  // Saat authed, cek pending idea dari flow guest -> register -> OTP -> dashboard.
  useEffect(() => {
    if (!authed) return;
    const timer = window.setTimeout(() => {
      try {
        const refNote = window.sessionStorage.getItem(WIZARD_REF_PENDING_KEY);
        if (refNote) {
          window.sessionStorage.removeItem(WIZARD_REF_PENDING_KEY);
          setReferenceNote(refNote);
        }
        const raw = window.sessionStorage.getItem(PENDING_KEY);
        if (!raw) return;
        window.sessionStorage.removeItem(PENDING_KEY);
        const parsed = JSON.parse(raw) as { idea?: string; language?: "id" | "en" };
        if (parsed.idea && parsed.idea.trim()) {
          setIdea(parsed.idea);
          if (parsed.language === "en" || parsed.language === "id") {
            setLanguage(parsed.language);
          }
          setPendingNotice(true);
          window.setTimeout(() => textareaRef.current?.focus(), 60);
        }
      } catch {
        // Abaikan storage error.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authed]);

  function selectTemplate(slug: string) {
    const tpl = getTemplate(slug);
    if (!tpl) return;
    setSelectedTemplate(tpl.name);
    setIdea((current) => (current.trim() ? current : `${tpl.ideaContext}\n\nIde saya: `));
    setActivePopover(null);
    textareaRef.current?.focus();
  }

  function appendDictation(text: string) {
    setIdea((current) => (current.trim() ? `${current.trim()} ${text}` : text));
  }

  async function submitIdea() {
    if (loading) return;
    if (!idea.trim()) {
      setError("Tulis dulu idemu.");
      triggerShake();
      textareaRef.current?.focus();
      return;
    }
    setError("");
    setActivePopover(null);

    if (!authed) {
      try {
        window.sessionStorage.setItem(PENDING_KEY, JSON.stringify({ idea, language }));
        if (referenceNote.trim()) {
          window.sessionStorage.setItem(WIZARD_REF_PENDING_KEY, referenceNote.trim());
        } else {
          window.sessionStorage.removeItem(WIZARD_REF_PENDING_KEY);
        }
      } catch {
        // Abaikan jika sessionStorage tidak tersedia.
      }
      router.push("/register?next=/dashboard");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, modelId, language }),
      });
      const data = (await res.json()) as { project?: { id: string }; error?: string };
      if (!res.ok || !data.project) {
        setError(data.error ?? "Gagal membuat project.");
        triggerShake();
        return;
      }
      if (referenceNote.trim()) {
        try {
          window.sessionStorage.setItem(wizardRefStorageKey(data.project.id), referenceNote.trim());
        } catch {
          // Abaikan storage error.
        }
      }
      router.push(`/dashboard/${data.project.id}`);
    } catch {
      setError("Tidak bisa menghubungi server.");
      triggerShake();
    } finally {
      setLoading(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submitIdea();
  }

  return (
    <div ref={composerRef} className={variant === "hero" ? "mx-auto w-full max-w-3xl text-left" : "w-full"}>
      {/* Folder-style Mode Tabs */}
      <div className="flex items-end gap-1.5 px-2" role="tablist" aria-label="Mode">
        <button
          type="button"
          role="tab"
          aria-selected="true"
          className="relative rounded-t-xl border border-b-0 border-slate-700/80 bg-[#0d1326] px-4 py-2 text-xs font-semibold text-white"
        >
          <motion.span
            layoutId="composer-tab"
            className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa]"
          />
          <span className="relative flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#35d6ff]" />
            Plan
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected="false"
          aria-disabled="true"
          disabled
          className="flex cursor-not-allowed items-center gap-1.5 rounded-t-xl border border-b-0 border-slate-800/60 bg-slate-900/35 px-3.5 py-2 text-xs font-medium text-slate-400"
        >
          <span>Desain</span>
          <span className="rounded-md border border-slate-700/80 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-400">
            Segera
          </span>
        </button>
      </div>

      {/* Main Composer Card */}
      <form
        ref={formScope}
        onSubmit={handleFormSubmit}
        className="glow-border-focus relative rounded-2xl rounded-tl-none border border-slate-700/80 bg-[#0d1326]/90 p-3.5 shadow-2xl shadow-black/50 backdrop-blur-md sm:p-4"
      >
        <AnimatePresence>
          {pendingNotice ? (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mb-2 flex items-center justify-between rounded-lg border border-[#35d6ff]/30 bg-[#35d6ff]/10 px-3 py-1.5 text-xs text-[#7fe3ff]"
            >
              <span>Idemu tadi sudah disimpan — tinggal kirim.</span>
              <button
                type="button"
                onClick={() => setPendingNotice(false)}
                className="ml-2 text-slate-300 hover:text-white"
                aria-label="Tutup pemberitahuan"
              >
                ×
              </button>
            </motion.p>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {selectedTemplate || referenceNote.trim() ? (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {selectedTemplate ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  className="inline-flex items-center gap-2 rounded-full border border-[#35d6ff]/40 bg-[#35d6ff]/10 px-3 py-1 text-xs text-[#7fe3ff]"
                >
                  <span>Template: {selectedTemplate}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate("")}
                    aria-label="Hapus pilihan template"
                    className="rounded-full px-1 text-slate-300 hover:text-white"
                  >
                    ×
                  </button>
                </motion.div>
              ) : null}
              {referenceNote.trim() ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  className="inline-flex items-center gap-2 rounded-full border border-[#a78bfa]/40 bg-[#a78bfa]/10 px-3 py-1 text-xs text-violet-200"
                >
                  <span className="max-w-[220px] truncate">Referensi: {referenceNote.trim()}</span>
                  <button
                    type="button"
                    onClick={() => setReferenceNote("")}
                    aria-label="Hapus referensi"
                    className="rounded-full px-1 text-slate-300 hover:text-white"
                  >
                    ×
                  </button>
                </motion.div>
              ) : null}
            </div>
          ) : null}
        </AnimatePresence>

        <textarea
          ref={textareaRef}
          aria-label="Ide aplikasi"
          value={idea}
          onChange={(e) => {
            setIdea(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submitIdea();
            }
          }}
          maxLength={8000}
          rows={3}
          style={{ fieldSizing: "content" } as React.CSSProperties}
          placeholder={reduced || idea.length > 0 ? EXAMPLES[0] : placeholder}
          className="min-h-[92px] max-h-[240px] w-full resize-none bg-transparent text-sm leading-relaxed text-slate-100 placeholder:text-slate-400 focus:outline-none sm:text-base"
        />

        {/* Toolbar */}
        <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* + Popover trigger */}
            <button
              type="button"
              onClick={() => setActivePopover((p) => (p === "plus" ? null : "plus"))}
              aria-label="Opsi tambahan"
              aria-expanded={activePopover === "plus"}
              className={`grid h-9 w-9 place-items-center rounded-full border text-sm transition ${
                activePopover === "plus"
                  ? "border-[#35d6ff]/70 bg-[#35d6ff]/15 text-white"
                  : "border-slate-700/80 bg-slate-900/60 text-slate-300 hover:border-slate-500 hover:text-white"
              }`}
            >
              +
            </button>

            {/* Template Popover trigger */}
            <button
              type="button"
              onClick={() => setActivePopover((p) => (p === "template" ? null : "template"))}
              aria-expanded={activePopover === "template"}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                activePopover === "template"
                  ? "border-[#35d6ff]/70 bg-[#35d6ff]/15 text-white"
                  : "border-slate-700/80 bg-slate-900/60 text-slate-300 hover:border-slate-500 hover:text-white"
              }`}
            >
              <IconBox className="h-3.5 w-3.5 text-[#35d6ff]" />
              <span>Template</span>
            </button>

            {/* Referensi Popover trigger */}
            <button
              type="button"
              onClick={() => setActivePopover((p) => (p === "reference" ? null : "reference"))}
              aria-expanded={activePopover === "reference"}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                activePopover === "reference" || referenceNote.trim()
                  ? "border-[#a78bfa]/70 bg-[#a78bfa]/15 text-white"
                  : "border-slate-700/80 bg-slate-900/60 text-slate-300 hover:border-slate-500 hover:text-white"
              }`}
            >
              <span aria-hidden="true" className="text-[11px] text-[#a78bfa]">
                @
              </span>
              <span>Referensi</span>
            </button>

            {variant === "dashboard" && providers && providers.length > 0 ? (
              <select
                aria-label="Model AI"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="max-w-[190px] truncate rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-200 outline-none transition hover:border-slate-500 focus:border-[#35d6ff]"
              >
                {providers.map((provider) => (
                  <optgroup key={provider.id} label={provider.label}>
                    {provider.models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.model}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            ) : null}

            <button
              type="button"
              onClick={() => setLanguage((lang) => (lang === "id" ? "en" : "id"))}
              aria-label="Ubah bahasa output PRD"
              title="Klik untuk ganti bahasa output PRD"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-950/70 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-[#35d6ff]/60 hover:text-white"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#35d6ff]" />
              <span>{language === "id" ? "Bahasa Indonesia" : "English"}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <DictationButton onText={appendDictation} />
            <button
              type="submit"
              disabled={loading}
              aria-label="Kirim"
              title="Kirim ide"
              className={`btn-shine grid h-9 w-9 place-items-center rounded-full transition disabled:opacity-60 ${
                idea.trim()
                  ? "bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] text-slate-950 shadow-lg shadow-[#35d6ff]/25 hover:brightness-110"
                  : "border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white"
              }`}
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
              ) : (
                <IconArrowRight className="h-4 w-4 -rotate-90" />
              )}
            </button>
          </div>

          {/* + Popover */}
          <AnimatePresence>
            {activePopover === "plus" ? (
              <motion.div
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 6 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 6 }}
                transition={{ duration: 0.16 }}
                className="absolute bottom-14 left-0 z-20 w-64 origin-bottom-left rounded-xl border border-slate-700/80 bg-[#0b1022] p-2.5 shadow-2xl"
              >
                <button
                  type="button"
                  onClick={() => setActivePopover("template")}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-slate-200 transition hover:bg-slate-800/70"
                >
                  <span>Pakai template…</span>
                  <span className="text-slate-500">→</span>
                </button>
                <div className="my-1.5 h-px bg-slate-800" />
                <div className="px-3 py-1.5">
                  <p className="text-[11px] font-medium text-slate-400">Bahasa output PRD</p>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {(
                      [
                        ["id", "Indonesia"],
                        ["en", "English"],
                      ] as const
                    ).map(([code, label]) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setLanguage(code)}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                          language === code
                            ? "bg-linear-to-r from-[#4f7cff] to-[#35d6ff] text-slate-950"
                            : "border border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Referensi Popover */}
          <AnimatePresence>
            {activePopover === "reference" ? (
              <motion.div
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 6 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 6 }}
                transition={{ duration: 0.16 }}
                className="absolute bottom-14 left-0 z-20 w-80 max-w-[calc(100vw-3rem)] origin-bottom-left rounded-xl border border-slate-700/80 bg-[#0b1022] p-3 shadow-2xl"
              >
                <p className="text-xs font-semibold text-slate-100">Referensi / Link Inspirasi</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Tempel URL inspirasi, catatan kompetitor, atau constraint khusus (opsional).
                </p>
                <textarea
                  value={referenceNote}
                  onChange={(e) => setReferenceNote(e.target.value)}
                  rows={3}
                  maxLength={800}
                  placeholder="Misal: Mirip tokoonline.id, wajib dukung pembayaran QRIS & ongkir otomatis."
                  className="mt-2 w-full rounded-lg border border-slate-700/80 bg-slate-950/70 p-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-[#35d6ff] focus:outline-none"
                />
                <div className="mt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setReferenceNote("");
                      setActivePopover(null);
                    }}
                    className="text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    Hapus
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePopover(null)}
                    className="rounded-lg bg-[#35d6ff]/15 px-3 py-1 text-xs font-medium text-[#7fe3ff] hover:bg-[#35d6ff]/25"
                  >
                    Simpan
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Template Popover */}
          <AnimatePresence>
            {activePopover === "template" ? (
              <motion.div
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 6 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 6 }}
                transition={{ duration: 0.16 }}
                className="absolute bottom-14 left-0 z-20 w-80 max-w-[calc(100vw-3rem)] origin-bottom-left rounded-xl border border-slate-700/80 bg-[#0b1022] p-2.5 shadow-2xl"
              >
                <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Pilih starter kit
                </p>
                <div className="space-y-1.5">
                  {TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.slug}
                      type="button"
                      onClick={() => selectTemplate(tpl.slug)}
                      className="flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition hover:bg-slate-800/70"
                    >
                      <TemplateGlyph slug={tpl.slug} className="h-9 w-9" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-100">{tpl.name}</p>
                        <p className="line-clamp-2 text-[11px] text-slate-400">{tpl.tagline}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {error ? (
            <motion.p
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-2.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300"
            >
              {error}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </form>

      {/* Suggestion chips & link under hero variant */}
      {variant === "hero" ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
          {SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => {
                setIdea(chip.text);
                setError("");
                textareaRef.current?.focus();
              }}
              className="rounded-full border border-slate-800 bg-slate-900/50 px-3 py-1 text-slate-300 transition hover:border-[#35d6ff]/50 hover:bg-slate-900 hover:text-white"
            >
              {chip.label}
            </button>
          ))}
          <Link href="/templates" className="px-2 py-1 text-[#35d6ff] transition hover:underline">
            Lihat starter kit →
          </Link>
          <Link
            href={authed ? "/dashboard" : "/login?next=/dashboard"}
            className="px-2 py-1 text-slate-300 transition hover:text-white hover:underline"
          >
            Lihat PRD sebelumnya →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
