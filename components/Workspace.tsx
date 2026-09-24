"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { extractFeatureList } from "@/lib/roadmap";
import { parseTasks, type ParsedTask } from "@/lib/tasks";
import { MarkdownView } from "./MarkdownView";
import { PrdMap } from "./PrdMap";
import { useSse } from "./useSse";

export interface WorkspaceMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

export interface WorkspaceProject {
  id: string;
  title: string;
  idea: string;
  modelId: string;
  language: "id" | "en";
  status: string;
  updatedAt: number;
}

export interface WorkspaceQuota {
  used: number;
  limit: number;
  remaining: number;
  allowed: boolean;
  resetsAt: number;
}

interface Props {
  project: WorkspaceProject;
  initialMessages: WorkspaceMessage[];
  initialPrd: string | null;
  quota: WorkspaceQuota;
  models: { id: string; label: string; models: { id: string; model: string }[] }[];
}

type Tab = "preview" | "edit" | "tasks" | "map";

/**
 * Penghitung detik untuk fase "model belum mengeluarkan token".
 * Provider seperti Gemini bisa butuh puluhan detik untuk prompt PRD besar,
 * jadi user perlu melihat bahwa proses masih berjalan.
 */
function ElapsedTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="tabular-nums">{seconds}s</span>;
}

function ThinkingBubble({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-400">
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-400 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-400 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-400 [animation-delay:300ms]" />
      </span>
      <span>
        {label} (<ElapsedTimer />)
      </span>
    </div>
  );
}

/** Ringkasan metadata task untuk ditampilkan di tab Task. */
function taskMeta(task: ParsedTask): string {
  const parts: string[] = [];
  if (task.files.length) parts.push(`file: ${task.files.join(", ")}`);
  if (task.depends.length) parts.push(`depends: ${task.depends.join(", ")}`);
  if (task.complexity !== "?") parts.push(`kompleksitas: ${task.complexity}`);
  return parts.join(" · ");
}

export function Workspace({ project, initialMessages, initialPrd, quota, models }: Props) {
  const router = useRouter();
  const { post, streaming } = useSse();

  const [messages, setMessages] = useState<WorkspaceMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [prd, setPrd] = useState(initialPrd ?? "");
  const [tab, setTab] = useState<Tab>(initialPrd ? "preview" : "preview");
  const [quotaState, setQuotaState] = useState(quota);
  const [readyForPrd, setReadyForPrd] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [modelId, setModelId] = useState(project.modelId);
  const [title, setTitle] = useState(project.title);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);
  const tasks = useMemo(() => parseTasks(prd), [prd]);
  const features = useMemo(() => extractFeatureList(prd), [prd]);
  const doneCount = tasks.filter((t) => t.done).length;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamText]);

  async function sendText(raw: string) {
    const text = raw.trim();
    if (!text || streaming || generating) return;
    setError("");
    setWarning("");
    setMessages((prev) => [...prev, { id: `local_${Date.now()}`, role: "user", content: text, createdAt: Date.now() }]);
    setStreamText("");

    let assistantText = "";
    await post(
      `/api/projects/${project.id}/chat`,
      { message: text },
      {
        onDelta: (delta) => {
          assistantText += delta;
          setStreamText(assistantText);
        },
        onDone: (data) => {
          setMessages((prev) => [
            ...prev,
            {
              id: String(data.messageId ?? `local_a_${Date.now()}`),
              role: "assistant",
              content: assistantText.replace(/\[\[SIAP_PRD\]\]/g, "").trim(),
              createdAt: Date.now(),
            },
          ]);
          setStreamText("");
          if (data.readyForPrd) setReadyForPrd(true);
          if (typeof data.warning === "string") setWarning(data.warning);
        },
        onError: (message) => {
          setStreamText("");
          setError(message);
        },
      },
    );
  }

  // Kirim ide produk sebagai pesan pertama supaya AI langsung bertanya klarifikasi.
  useEffect(() => {
    if (autoSentRef.current) return;
    if (initialMessages.length > 0) return;
    if (!project.idea.trim()) return;
    autoSentRef.current = true;
    const timer = setTimeout(() => {
      void sendText(project.idea);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await sendText(text);
  }

  async function generatePrd() {
    if (generating || streaming) return;
    setError("");
    setWarning("");
    setGenerating(true);
    setTab("preview");
    setStreamText("");
    let output = "";

    await post(
      `/api/projects/${project.id}/generate`,
      {},
      {
        onDelta: (delta) => {
          output += delta;
          setStreamText(output);
        },
        onDone: (data) => {
          const prdData = data.prd as { content?: string } | undefined;
          if (prdData?.content) {
            setPrd(prdData.content);
            setReadyForPrd(false);
            setSavedAt(Date.now());
          }
          if (data.quota) {
            const q = data.quota as WorkspaceQuota;
            setQuotaState(q);
          }
          setStreamText("");
          if (typeof data.warning === "string") setWarning(data.warning);
          router.refresh();
        },
        onError: (message) => {
          setStreamText("");
          setError(message);
        },
      },
    );
    setGenerating(false);
  }

  async function savePrd() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${project.id}/prd`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: prd }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Gagal menyimpan PRD.");
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    } catch {
      setError("Tidak bisa menghubungi server.");
    } finally {
      setSaving(false);
    }
  }

  async function changeModel(nextModelId: string) {
    setModelId(nextModelId);
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: nextModelId }),
    });
  }

  async function renameProject(nextTitle: string) {
    setTitle(nextTitle);
    await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: nextTitle }),
    });
  }

  const busy = streaming || generating;

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link href="/dashboard" className="shrink-0 text-sm text-slate-400 hover:text-white">
            ← Dashboard
          </Link>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next && next !== project.title) void renameProject(next);
            }}
            className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-lg font-semibold outline-none hover:border-slate-800 focus:border-sky-500"
            aria-label="Judul project"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            value={modelId}
            onChange={(e) => void changeModel(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs outline-none focus:border-sky-500"
            aria-label="Model AI"
          >
            {models.map((provider) => (
              <optgroup key={provider.id} label={provider.label}>
                {provider.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.model}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <span className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
            Kuota: {quotaState.remaining}/{quotaState.limit}
          </span>
        </div>
      </div>

      {error ? (
        <p className="no-print mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {warning ? (
        <p className="no-print mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {warning}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Panel chat */}
        <section className="no-print flex h-[calc(100vh-13rem)] flex-col rounded-2xl border border-slate-800 bg-slate-900/40">
          <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Ngobrol dengan AI</h2>
              <p className="text-xs text-slate-500">AI akan tanya dulu sebelum menyusun PRD.</p>
            </div>
            {readyForPrd ? (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-300">Siap disusun</span>
            ) : null}
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && !streamText ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-4 text-sm text-slate-400">
                <p className="font-medium text-slate-300">Mulai dari sini</p>
                <p className="mt-1">Jawab pertanyaan AI satu per satu, atau ceritakan lebih detail idemu:</p>
                <p className="mt-2 rounded-lg bg-slate-950/70 p-2 text-xs text-slate-400">
                  &ldquo;Targetnya pemilik warung kopi kecil, fitur wajib: catat pesanan dan rekap harian. Batasannya harus
                  jalan di HP Android murah.&rdquo;
                </p>
              </div>
            ) : null}

            {messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    message.role === "user"
                      ? "bg-sky-500 text-slate-950"
                      : "border border-slate-800 bg-slate-950/70 text-slate-200"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <MarkdownView content={message.content} />
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            ))}

            {streamText ? (
              <div className="flex justify-start">
                <div className="max-w-[92%] rounded-2xl border border-slate-800 bg-slate-950/70 px-3.5 py-2.5">
                  <MarkdownView content={streamText.replace(/\[\[SIAP_PRD\]\]/g, "")} />
                  <span className="mt-1 inline-block h-3 w-1.5 animate-pulse bg-sky-400 align-middle" />
                </div>
              </div>
            ) : streaming ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3.5 py-2.5">
                <ThinkingBubble label="Model sedang menyiapkan balasan" />
              </div>
            ) : null}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={sendMessage} className="border-t border-slate-800 p-3">
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage(e);
                  }
                }}
                rows={2}
                maxLength={6000}
                placeholder="Tulis jawaban atau pertanyaan... (Enter untuk kirim)"
                className="flex-1 resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
              />
              <button
                type="submit"
                disabled={busy || !draft.trim()}
                className="rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
              >
                Kirim
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => void generatePrd()}
                disabled={busy || (!readyForPrd && messages.length === 0) || quotaState.remaining <= 0}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  readyForPrd
                    ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                    : "border border-slate-700 text-slate-300 hover:border-slate-500"
                } disabled:opacity-40`}
              >
                {generating ? "Menyusun PRD..." : prd ? "Susun ulang PRD" : "Generate PRD"}
              </button>
              <p className="text-xs text-slate-500">
                {quotaState.remaining > 0
                  ? `Sisa kuota bulan ini: ${quotaState.remaining}`
                  : "Kuota habis — upgrade paket untuk lanjut"}
              </p>
            </div>
          </form>
        </section>

        {/* Panel PRD */}
        <section className="flex h-[calc(100vh-13rem)] flex-col rounded-2xl border border-slate-800 bg-slate-900/40">
          <header className="no-print flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-2.5">
            <div className="flex gap-1 rounded-lg bg-slate-950/70 p-1">
              {(
                [
                  ["preview", "Preview"],
                  ["edit", "Editor"],
                  ["tasks", `Task (${tasks.length})`],
                  ["map", "Peta"],
                ] as [Tab, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    tab === value ? "bg-sky-500 text-slate-950" : "text-slate-300 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void savePrd()}
                disabled={saving || !prd}
                className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-40"
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
              <a
                href={`/api/projects/${project.id}/export?format=markdown`}
                className={`rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:border-slate-500 ${
                  prd ? "" : "pointer-events-none opacity-40"
                }`}
              >
                .md
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={!prd}
                className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-40"
              >
                PDF
              </button>
            </div>
          </header>

          <div className="print-area flex-1 overflow-y-auto px-5 py-4">
            {generating || (streaming && !prd) ? (
              streamText ? (
                <MarkdownView content={streamText} />
              ) : (
                <div className="grid h-full place-items-center">
                  <ThinkingBubble label="Menyusun PRD lengkap" />
                </div>
              )
            ) : !prd ? (
              <div className="grid h-full place-items-center text-center">
                <div className="max-w-sm text-sm text-slate-400">
                  <p className="font-medium text-slate-300">Belum ada PRD</p>
                  <p className="mt-1">
                    Selesaikan sesi tanya-jawab di panel kiri, lalu tekan <span className="text-sky-400">Generate PRD</span>.
                  </p>
                </div>
              </div>
            ) : tab === "preview" ? (
              <>
                <div className="no-print mb-3 flex items-center gap-2 text-xs text-slate-500">
                  <span>Versi terakhir disimpan {savedAt ? "baru saja" : "di server"}</span>
                </div>
                <MarkdownView content={prd} />
              </>
            ) : tab === "edit" ? (
              <textarea
                value={prd}
                onChange={(e) => setPrd(e.target.value)}
                className="h-full w-full resize-none rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-200 outline-none focus:border-sky-500"
                spellCheck={false}
              />
            ) : tab === "map" ? (
              <PrdMap tasks={tasks} features={features} projectTitle={title} />
            ) : (
              <div>
                {tasks.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    Bagian Task Breakdown belum ada di PRD ini. Coba generate ulang, atau tambahkan manual dengan format
                    <code className="mx-1 rounded bg-slate-800 px-1.5 py-0.5 text-xs">
                      - [ ] T1 — judul | file: path | depends: none | kompleksitas: M
                    </code>
                  </p>
                ) : (
                  <>
                    <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-slate-400">
                        {tasks.length} task · {doneCount} selesai
                      </p>
                      <div className="flex gap-1.5">
                        <a
                          href={`/api/projects/${project.id}/export?format=tasks-md`}
                          className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:border-slate-500"
                        >
                          Export checklist .md
                        </a>
                        <a
                          href={`/api/projects/${project.id}/export?format=tasks-json`}
                          className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:border-slate-500"
                        >
                          Export .json
                        </a>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {tasks.map((task) => (
                        <li key={task.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-sky-300">
                              {task.id}
                            </span>
                            <p className={`flex-1 text-sm ${task.done ? "text-slate-500 line-through" : "text-slate-200"}`}>
                              {task.title}
                            </p>
                          </div>
                          {taskMeta(task) ? <p className="mt-2 text-xs text-slate-500">{taskMeta(task)}</p> : null}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
