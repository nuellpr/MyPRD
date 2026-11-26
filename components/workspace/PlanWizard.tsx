"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import {
  buildFallbackQuestions,
  formatWizardSummary,
  type ClarifyingQuestion,
  type WizardAnswer,
} from "@/lib/questions";
import { DictationButton } from "../DictationButton";
import { IconArrowRight, IconCheck, IconSparkles } from "../icons";
import { MarkdownView } from "../MarkdownView";
import { wizardRefStorageKey } from "../PromptComposer";

const STACK_GROUPS: { group: string; items: string[] }[] = [
  { group: "Frontend", items: ["Next.js App Router", "React + Vite", "TanStack Start", "Vue / Nuxt"] },
  { group: "Backend & DB", items: ["Next.js API + PostgreSQL", "Supabase", "FastAPI + SQLModel", "SQLite + Drizzle"] },
  { group: "UI & Animasi", items: ["Tailwind CSS", "shadcn/ui", "Motion / Framer Motion"] },
  { group: "Auth & Pembayaran", items: ["Email OTP / NextAuth", "Midtrans QRIS", "Stripe"] },
];

function ElapsedTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  return <span className="tabular-nums">{seconds}s</span>;
}

interface PlanWizardProps {
  project: {
    id: string;
    title: string;
    idea: string;
    language: "id" | "en";
    modelId: string;
  };
  streaming: boolean;
  streamText: string;
  error: string;
  quotaAllowed: boolean;
  onGenerate: (wizardContext?: string) => Promise<void>;
  onSwitchToManualChat: () => void;
}

export function PlanWizard({
  project,
  streaming,
  streamText,
  error,
  quotaAllowed,
  onGenerate,
  onSwitchToManualChat,
}: PlanWizardProps) {
  const reduced = useReducedMotion();
  const [step, setStep] = useState<2 | 3>(2);
  const [techMode, setTechMode] = useState<"ai" | "custom">("ai");
  const [selectedStack, setSelectedStack] = useState<string[]>(["Next.js App Router", "Tailwind CSS"]);
  const [customStack, setCustomStack] = useState("");
  const [referenceNote, setReferenceNote] = useState("");
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>(() =>
    buildFallbackQuestions(project.idea, project.language),
  );
  const [answers, setAnswers] = useState<Record<string, WizardAnswer>>({});
  const [otherInputs, setOtherInputs] = useState<Record<string, string>>({});
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Ambil catatan referensi dari composer bila ada.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const key = wizardRefStorageKey(project.id);
        const val = window.sessionStorage.getItem(key);
        if (val) setReferenceNote(val);
      } catch {
        // Abaikan error storage.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [project.id]);

  const answeredCount = useMemo(() => {
    return questions.filter((q) => {
      const ans = answers[q.id];
      if (!ans) return false;
      if (ans.skipped) return true;
      if (q.type === "text") return Boolean(ans.text?.trim());
      return Boolean((ans.selected && ans.selected.length > 0) || ans.text?.trim());
    }).length;
  }, [questions, answers]);

  function toggleStackItem(item: string) {
    setSelectedStack((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item],
    );
  }

  async function handleGoStep3() {
    if (loadingQuestions) return;
    setLoadingQuestions(true);
    try {
      const techPref =
        techMode === "ai"
          ? "Biarkan AI pilih"
          : [selectedStack.join(", "), customStack.trim()].filter(Boolean).join(" · ") || "Custom";
      const res = await fetch(`/api/projects/${project.id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: project.idea,
          language: project.language,
          techPreference: techPref,
          referenceNote,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { questions?: ClarifyingQuestion[] };
        if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions);
        }
      }
    } catch {
      // Tetap lanjut dengan fallback questions yang sudah tersedia.
    } finally {
      setLoadingQuestions(false);
      setStep(3);
    }
  }

  function updateAnswer(questionId: string, patch: Partial<WizardAnswer>) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        ...patch,
        questionId,
        skipped: patch.skipped ?? false,
      },
    }));
  }

  function toggleOption(q: ClarifyingQuestion, option: string) {
    const current = answers[q.id]?.selected ?? [];
    if (q.type === "single") {
      const next = current.includes(option) ? [] : [option];
      updateAnswer(q.id, { selected: next, skipped: false });
      return;
    }
    const next = current.includes(option)
      ? current.filter((x) => x !== option)
      : [...current, option];
    updateAnswer(q.id, { selected: next, skipped: false });
  }

  function toggleSkip(questionId: string) {
    const wasSkipped = Boolean(answers[questionId]?.skipped);
    updateAnswer(questionId, {
      skipped: !wasSkipped,
      selected: wasSkipped ? answers[questionId]?.selected : [],
      text: wasSkipped ? answers[questionId]?.text : "",
    });
  }

  async function handleGenerateClick() {
    if (streaming || !quotaAllowed) return;
    const summary = formatWizardSummary({
      techMode,
      selectedStack,
      customStack,
      referenceNote,
      questions,
      answers: Object.fromEntries(
        questions.map((q) => {
          const a = answers[q.id];
          const extra = otherInputs[q.id]?.trim();
          return [
            q.id,
            {
              questionId: q.id,
              text: [a?.text?.trim(), extra].filter(Boolean).join(" | "),
              selected: a?.selected,
              skipped: a?.skipped,
            },
          ];
        }),
      ),
    });
    try {
      window.sessionStorage.removeItem(wizardRefStorageKey(project.id));
    } catch {
      // Abaikan storage error.
    }
    await onGenerate(summary);
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
      {/* Stepper Header: Ide -> PRD -> Task */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/80 bg-[#0d1326]/90 px-4 py-3.5 shadow-xl shadow-black/30">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <IconCheck className="h-3.5 w-3.5" />
            <span>1. Ide</span>
          </div>
          <span className="text-slate-600">→</span>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#35d6ff]/60 bg-[#35d6ff]/15 px-3 py-1 text-xs font-semibold text-[#7fe3ff]">
            <span className="h-2 w-2 rounded-full bg-[#35d6ff]" />
            <span>2. PRD</span>
          </div>
          <span className="text-slate-600">→</span>
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
              streaming
                ? "border-[#a78bfa]/50 bg-[#a78bfa]/15 text-violet-200"
                : "border-slate-800 bg-slate-900/60 text-slate-400"
            }`}
          >
            <span>3. Task</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onSwitchToManualChat}
          disabled={streaming}
          className="text-xs text-slate-400 transition hover:text-[#35d6ff] disabled:opacity-50"
        >
          Mode obrolan manual →
        </button>
      </div>

      {/* Ringkasan Ide & Referensi */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#0a0f1f]/90 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#35d6ff]">
            Ide Aplikasi Kamu
          </p>
          <span className="rounded-full border border-slate-800 bg-slate-900/70 px-2.5 py-0.5 text-[11px] text-slate-400">
            {project.language === "en" ? "Output: English" : "Output: Bahasa Indonesia"}
          </span>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{project.idea}</p>
        {referenceNote.trim() ? (
          <div className="mt-3 rounded-xl border border-[#a78bfa]/30 bg-[#a78bfa]/10 px-3 py-2 text-xs text-violet-200">
            <span className="font-semibold">Referensi:</span> {referenceNote}
          </div>
        ) : null}
      </div>

      {/* Mode Streaming: Live PRD generation view */}
      {streaming ? (
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-[#35d6ff]/40 bg-[#0d1326]/95 p-5 shadow-2xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-linear-to-br from-[#4f7cff] to-[#35d6ff] text-slate-950">
                <IconSparkles className="h-4 w-4 animate-pulse" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">
                  Menyusun PRD, diagram arsitektur & daftar task…
                </p>
                <p className="text-xs text-slate-400">
                  Waktu berjalan: <ElapsedTimer /> · Workspace otomatis terbuka setelah selesai
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 max-h-[420px] overflow-y-auto rounded-xl border border-slate-800/80 bg-[#070a14]/90 p-4">
            {streamText ? (
              <MarkdownView content={streamText} renderMermaid={false} />
            ) : (
              <div className="space-y-3 py-4">
                <div className="h-3 w-2/3 animate-pulse rounded bg-slate-800" />
                <div className="h-3 w-full animate-pulse rounded bg-slate-800/80" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-slate-800/70" />
              </div>
            )}
          </div>
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          {step === 2 ? (
            <motion.section
              key="wizard-step-2"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-slate-800/80 bg-[#0d1326]/90 p-5 shadow-xl sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Preferensi teknologi</h2>
                  <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                    Pilih apakah AI menentukan tech stack terbaik atau kamu ingin mengaturnya sendiri.
                  </p>
                </div>
                <span className="rounded-full border border-slate-700/80 bg-slate-900/70 px-3 py-1 text-xs text-slate-300">
                  Langkah 1 dari 2
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setTechMode("ai")}
                  className={`rounded-xl border p-4 text-left transition ${
                    techMode === "ai"
                      ? "border-[#35d6ff] bg-[#35d6ff]/10 shadow-lg shadow-[#35d6ff]/10"
                      : "border-slate-800 bg-slate-950/60 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">Biarkan AI pilih</span>
                    <span
                      className={`grid h-5 w-5 place-items-center rounded-full border ${
                        techMode === "ai"
                          ? "border-[#35d6ff] bg-[#35d6ff] text-slate-950"
                          : "border-slate-600"
                      }`}
                    >
                      {techMode === "ai" ? <IconCheck className="h-3 w-3" /> : null}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                    Rekomendasi arsitektur paling cepat dibangun, aman, dan cocok untuk coding bersama AI agent.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTechMode("custom")}
                  className={`rounded-xl border p-4 text-left transition ${
                    techMode === "custom"
                      ? "border-[#35d6ff] bg-[#35d6ff]/10 shadow-lg shadow-[#35d6ff]/10"
                      : "border-slate-800 bg-slate-950/60 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">Pilih sendiri</span>
                    <span
                      className={`grid h-5 w-5 place-items-center rounded-full border ${
                        techMode === "custom"
                          ? "border-[#35d6ff] bg-[#35d6ff] text-slate-950"
                          : "border-slate-600"
                      }`}
                    >
                      {techMode === "custom" ? <IconCheck className="h-3 w-3" /> : null}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                    Tentukan framework frontend, database, styling, dan layanan pembayaran favoritmu.
                  </p>
                </button>
              </div>

              {/* Panel Pilih Sendiri */}
              <AnimatePresence>
                {techMode === "custom" ? (
                  <motion.div
                    initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    animate={reduced ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                    exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-5 space-y-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                      {STACK_GROUPS.map((grp) => (
                        <div key={grp.group}>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            {grp.group}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {grp.items.map((item) => {
                              const active = selectedStack.includes(item);
                              return (
                                <button
                                  key={item}
                                  type="button"
                                  onClick={() => toggleStackItem(item)}
                                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                                    active
                                      ? "border-[#35d6ff] bg-[#35d6ff]/20 text-[#7fe3ff]"
                                      : "border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600"
                                  }`}
                                >
                                  {item}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      <div>
                        <label
                          htmlFor="wizard-custom-stack"
                          className="text-[11px] font-semibold uppercase tracking-wider text-slate-400"
                        >
                          Tambahan stack khusus (opsional)
                        </label>
                        <input
                          id="wizard-custom-stack"
                          type="text"
                          value={customStack}
                          onChange={(e) => setCustomStack(e.target.value)}
                          placeholder="Misal: Redis queue, Cloudinary, Midtrans Snap…"
                          className="mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-[#35d6ff] focus:outline-none"
                        />
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-4">
                <p className="text-xs text-slate-400">
                  Berikutnya: 5 pertanyaan singkat untuk mempertajam fitur PRD.
                </p>
                <button
                  type="button"
                  onClick={() => void handleGoStep3()}
                  disabled={loadingQuestions}
                  className="btn-shine inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-[#35d6ff]/20 transition hover:brightness-110 disabled:opacity-60"
                >
                  {loadingQuestions ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                      <span>Menyiapkan pertanyaan…</span>
                    </>
                  ) : (
                    <>
                      <span>Lanjut</span>
                      <IconArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.section>
          ) : (
            <motion.section
              key="wizard-step-3"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-slate-800/80 bg-[#0d1326]/90 p-5 shadow-xl sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-semibold text-white">Beberapa pertanyaan</h2>
                    <span
                      data-testid="wizard-progress-counter"
                      className="rounded-full border border-[#35d6ff]/40 bg-[#35d6ff]/15 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[#7fe3ff]"
                    >
                      {answeredCount}/{questions.length}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Jawab yang relevan atau klik Lewati jika ingin AI yang memutuskan.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-lg border border-slate-700/80 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
                >
                  ← Ubah teknologi
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {questions.map((q, index) => {
                  const ans = answers[q.id];
                  const isSkipped = Boolean(ans?.skipped);
                  const showOther = otherInputs[q.id] !== undefined;
                  return (
                    <div
                      key={q.id}
                      className={`rounded-xl border p-4 transition ${
                        isSkipped
                          ? "border-slate-800/60 bg-slate-950/40 opacity-75"
                          : "border-slate-800 bg-slate-950/75"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-100">
                          <span className="mr-2 font-mono text-xs text-[#35d6ff]">0{index + 1}</span>
                          {q.question}
                        </p>
                        <button
                          type="button"
                          onClick={() => toggleSkip(q.id)}
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                            isSkipped
                              ? "border-amber-400/50 bg-amber-400/15 text-amber-200"
                              : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                          }`}
                        >
                          {isSkipped ? "Dilewati" : "Lewati"}
                        </button>
                      </div>

                      {!isSkipped && q.type === "text" ? (
                        <div className="mt-3 space-y-2">
                          <textarea
                            rows={2}
                            value={ans?.text ?? ""}
                            onChange={(e) => updateAnswer(q.id, { text: e.target.value })}
                            placeholder="Tulis jawabanmu singkat di sini…"
                            className="w-full rounded-lg border border-slate-800 bg-slate-900/80 p-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-[#35d6ff] focus:outline-none"
                          />
                          <div className="flex items-center justify-end">
                            <DictationButton
                              onText={(txt) =>
                                updateAnswer(q.id, {
                                  text: ans?.text?.trim() ? `${ans.text.trim()} ${txt}` : txt,
                                })
                              }
                            />
                          </div>
                        </div>
                      ) : null}

                      {!isSkipped && q.type !== "text" ? (
                        <div className="mt-3 space-y-2.5">
                          <div className="flex flex-wrap gap-2">
                            {(q.options ?? []).map((opt) => {
                              const active = Boolean(ans?.selected?.includes(opt));
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => toggleOption(q, opt)}
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                    active
                                      ? "border-[#35d6ff] bg-[#35d6ff]/20 text-[#7fe3ff] shadow-sm shadow-[#35d6ff]/20"
                                      : "border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600 hover:text-white"
                                  }`}
                                >
                                  {active ? <IconCheck className="h-3 w-3" /> : null}
                                  <span>{opt}</span>
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() =>
                                setOtherInputs((prev) => {
                                  if (prev[q.id] !== undefined) {
                                    const copy = { ...prev };
                                    delete copy[q.id];
                                    return copy;
                                  }
                                  return { ...prev, [q.id]: "" };
                                })
                              }
                              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                showOther
                                  ? "border-[#a78bfa] bg-[#a78bfa]/15 text-violet-200"
                                  : "border-dashed border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                              }`}
                            >
                              + Lainnya
                            </button>
                          </div>

                          {showOther ? (
                            <input
                              type="text"
                              value={otherInputs[q.id] ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setOtherInputs((prev) => ({ ...prev, [q.id]: val }));
                                updateAnswer(q.id, { skipped: false });
                              }}
                              placeholder="Tulis pilihan atau catatan lain…"
                              className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-[#a78bfa] focus:outline-none"
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {error ? (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300"
                >
                  {error}
                </p>
              ) : null}

              {!quotaAllowed ? (
                <p className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200">
                  Kuota generate PRD bulananmu sedang habis. Upgrade paket di menu Billing untuk melanjutkan.
                </p>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-4">
                <p className="text-xs text-slate-400">
                  {answeredCount}/{questions.length} pertanyaan terjawab · Hasil siap dalam hitungan detik
                </p>
                <button
                  type="button"
                  onClick={() => void handleGenerateClick()}
                  disabled={!quotaAllowed || streaming}
                  className="btn-shine inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-[#35d6ff]/25 transition hover:brightness-110 disabled:opacity-50"
                >
                  <IconSparkles className="h-4 w-4" />
                  <span>Buat PRD &amp; Task Sekarang</span>
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
