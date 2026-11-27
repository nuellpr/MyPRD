"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { deriveTitleFromPrd } from "@/lib/prd";
import { buildFeatureTree } from "@/lib/roadmap";
import { parseTasks, updateTaskStatusesInPrd, type TaskStatus } from "@/lib/tasks";
import { IconBot, IconSparkles } from "./icons";
import { MarkdownView } from "./MarkdownView";
import { useSse } from "./useSse";
import { ImplementModal } from "./workspace/ImplementModal";
import { PlanWizard } from "./workspace/PlanWizard";
import { PrdWikiView } from "./workspace/PrdWikiView";
import { RoadmapCanvas } from "./workspace/RoadmapCanvas";
import { TaskKanban } from "./workspace/TaskKanban";
import { WorkspaceAgent } from "./workspace/WorkspaceAgent";

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
  initialPrdVersion?: number;
  quota: WorkspaceQuota;
  models: { id: string; label: string; models: { id: string; model: string }[] }[];
}

type WorkspaceView = "roadmap" | "wiki" | "tasks";

export function Workspace({
  project,
  initialMessages,
  initialPrd,
  initialPrdVersion = 1,
  quota,
}: Props) {
  const router = useRouter();
  const { post, streaming } = useSse();

  const [prd, setPrd] = useState(initialPrd ?? "");
  const [prdVersion, setPrdVersion] = useState(initialPrdVersion);
  const [projectTitle, setProjectTitle] = useState(project.title);
  const modelId = project.modelId;
  const [messages, setMessages] = useState<WorkspaceMessage[]>(initialMessages);
  const [quotaState, setQuotaState] = useState<WorkspaceQuota>(quota);

  const [view, setView] = useState<WorkspaceView>("roadmap");
  const [planMode, setPlanMode] = useState<"wizard" | "manual">("wizard");
  const [agentOpen, setAgentOpen] = useState(true);
  const [implementOpen, setImplementOpen] = useState(false);
  const [taskFeatureFilter, setTaskFeatureFilter] = useState("ALL");

  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState("");
  const [savingPrd, setSavingPrd] = useState(false);
  const [manualInput, setManualInput] = useState("");

  const tasks = useMemo(() => (prd ? parseTasks(prd) : []), [prd]);
  const features = useMemo(() => (prd ? buildFeatureTree(prd, tasks) : []), [prd, tasks]);
  const subFeatureCount = useMemo(
    () => features.reduce((sum, f) => sum + f.subFeatures.length, 0),
    [features],
  );

  const prdVersionRef = useRef(prdVersion);
  const savingPrdRef = useRef(savingPrd);
  const streamingRef = useRef(streaming);

  useEffect(() => {
    prdVersionRef.current = prdVersion;
  }, [prdVersion]);

  useEffect(() => {
    savingPrdRef.current = savingPrd;
  }, [savingPrd]);

  useEffect(() => {
    streamingRef.current = streaming;
  }, [streaming]);

  // Sinkronisasi otomatis setiap 3 detik saat tab aktif supaya progres AI agent muncul realtime.
  const hasPrd = Boolean(prd);
  useEffect(() => {
    if (!hasPrd) return;

    async function syncLatestPrd() {
      if (document.visibilityState !== "visible") return;
      if (savingPrdRef.current || streamingRef.current) return;
      try {
        const res = await fetch(`/api/projects/${project.id}/prd`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json().catch(() => ({}))) as {
          prd?: { content?: string; version?: number } | null;
        };
        if (
          data.prd?.content &&
          typeof data.prd.version === "number" &&
          data.prd.version > prdVersionRef.current &&
          !savingPrdRef.current &&
          !streamingRef.current
        ) {
          setPrd(data.prd.content);
          setPrdVersion(data.prd.version);
        }
      } catch {
        // Abaikan error jaringan sementara saat polling latar.
      }
    }

    const timer = window.setInterval(() => void syncLatestPrd(), 3000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncLatestPrd();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hasPrd, project.id]);

  async function savePrdContent(nextPrd: string) {
    const prevPrd = prd;
    setPrd(nextPrd);
    setSavingPrd(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${project.id}/prd`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: nextPrd }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setPrd(prevPrd);
        setError(data.error ?? "Gagal menyimpan perubahan PRD.");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        prd?: { content?: string; version?: number };
      };
      if (data.prd?.version) setPrdVersion(data.prd.version);
      const nextTitle = deriveTitleFromPrd(nextPrd, projectTitle);
      if (nextTitle) setProjectTitle(nextTitle);
    } catch {
      setPrd(prevPrd);
      setError("Tidak bisa menghubungi server saat menyimpan PRD.");
    } finally {
      setSavingPrd(false);
    }
  }

  async function updateTaskStatuses(taskIds: string[], nextStatus: TaskStatus) {
    if (!prd || taskIds.length === 0) return;
    const updated = updateTaskStatusesInPrd(prd, taskIds, nextStatus);
    if (updated === prd) return;
    await savePrdContent(updated);
  }

  async function toggleTaskDone(taskId: string, done: boolean) {
    await updateTaskStatuses([taskId], done ? "done" : "todo");
  }

  async function generatePrd(wizardContext?: string) {
    if (streaming || !quotaState.allowed) return;
    setError("");
    setStreamText("");

    if (wizardContext) {
      setMessages((prev) => [
        ...prev,
        {
          id: `wizard-${Date.now()}`,
          role: "user",
          content: wizardContext,
          createdAt: Date.now(),
        },
      ]);
    }

    await post(
      `/api/projects/${project.id}/generate`,
      { modelId, wizardContext },
      {
        onDelta: (delta) => setStreamText((prev) => prev + delta),
        onDone: (payload) => {
          setStreamText("");
          const nextPrdObj = payload.prd as { content?: string; version?: number } | undefined;
          const nextQuota = payload.quota as WorkspaceQuota | undefined;
          if (nextPrdObj?.content) {
            setPrd(nextPrdObj.content);
            setPrdVersion(nextPrdObj.version ?? 1);
            const derived = deriveTitleFromPrd(nextPrdObj.content, projectTitle);
            if (derived) setProjectTitle(derived);
            setView("roadmap");
            setAgentOpen(true);
            setMessages((prev) => [
              ...prev,
              {
                id: `gen-done-${Date.now()}`,
                role: "assistant",
                content:
                  "PRD, diagram Mermaid, skema database, dan daftar task sudah siap di Roadmap & Kanban.",
                createdAt: Date.now(),
              },
            ]);
          }
          if (nextQuota) setQuotaState(nextQuota);
          router.refresh();
        },
        onError: (msg) => {
          setStreamText("");
          setError(msg);
        },
      },
    );
  }

  async function handleAgentSend(mode: "revise" | "chat", text: string) {
    if (streaming) return;
    setError("");
    setStreamText("");

    const userMsg: WorkspaceMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    if (mode === "revise") {
      await post(
        `/api/projects/${project.id}/revise`,
        { instruction: text, modelId },
        {
          onDelta: (delta) => setStreamText((prev) => prev + delta),
          onDone: (payload) => {
            setStreamText("");
            const nextPrdObj = payload.prd as { content?: string; version?: number } | undefined;
            if (nextPrdObj?.content) {
              setPrd(nextPrdObj.content);
              setPrdVersion(nextPrdObj.version ?? prdVersion + 1);
              const derived = deriveTitleFromPrd(nextPrdObj.content, projectTitle);
              if (derived) setProjectTitle(derived);
              setMessages((prev) => [
                ...prev,
                {
                  id: `rev-${Date.now()}`,
                  role: "assistant",
                  content: `PRD diperbarui ke #v${nextPrdObj.version ?? prdVersion + 1}: "${text}".`,
                  createdAt: Date.now(),
                },
              ]);
            }
          },
          onError: (msg) => {
            setStreamText("");
            setError(msg);
          },
        },
      );
      return;
    }

    await post(
      `/api/projects/${project.id}/chat`,
      { message: text, modelId },
      {
        onDelta: (delta) => setStreamText((prev) => prev + delta),
        onDone: (payload) => {
          setStreamText((current) => {
            const finalContent = current.trim();
            if (finalContent) {
              setMessages((prev) => [
                ...prev,
                {
                  id: String(payload.messageId ?? `a-${Date.now()}`),
                  role: "assistant",
                  content: finalContent,
                  createdAt: Date.now(),
                },
              ]);
            }
            return "";
          });
        },
        onError: (msg) => {
          setStreamText("");
          setError(msg);
        },
      },
    );
  }

  async function handleManualChatSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = manualInput.trim();
    if (!text || streaming) return;
    setManualInput("");
    await handleAgentSend("chat", text);
  }

  // Belum ada PRD: tampilkan PlanWizard terpandu (atau fallback chat manual).
  if (!prd) {
    if (planMode === "wizard") {
      return (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PlanWizard
            project={{
              id: project.id,
              title: projectTitle,
              idea: project.idea,
              language: project.language,
              modelId,
            }}
            streaming={streaming}
            streamText={streamText}
            error={error}
            quotaAllowed={quotaState.allowed}
            onGenerate={generatePrd}
            onSwitchToManualChat={() => setPlanMode("manual")}
          />
        </div>
      );
    }

    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#0d1326]/90 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPlanMode("wizard")}
              disabled={streaming}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
            >
              ← Kembali ke Wizard
            </button>
            <h1 className="text-sm font-semibold text-white">{projectTitle}</h1>
          </div>

          <button
            type="button"
            onClick={() => void generatePrd()}
            disabled={streaming || !quotaState.allowed}
            className="btn-shine inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50"
          >
            <IconSparkles className="h-3.5 w-3.5" />
            <span>Buat PRD Sekarang</span>
          </button>
        </div>

        <div className="flex min-h-[420px] flex-1 flex-col rounded-2xl border border-slate-800 bg-[#0a0f1f] p-4">
          <div className="flex-1 space-y-3 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
                Diskusikan detail kebutuhan aplikasimu atau klik <strong className="text-slate-200">Buat PRD Sekarang</strong>.
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl border px-3.5 py-2.5 text-xs ${
                    m.role === "user"
                      ? "ml-10 border-[#4f7cff]/40 bg-[#4f7cff]/12 text-slate-100"
                      : "mr-10 border-slate-800 bg-[#0d1326] text-slate-200"
                  }`}
                >
                  <MarkdownView content={m.content} className="text-xs" />
                </div>
              ))
            )}
            {streaming && streamText ? (
              <div className="mr-10 rounded-xl border border-[#35d6ff]/40 bg-[#0d1326] p-3.5 text-xs">
                <MarkdownView content={streamText} className="text-xs" renderMermaid={false} />
              </div>
            ) : null}
          </div>

          {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}

          <form onSubmit={(e) => void handleManualChatSubmit(e)} className="mt-3 flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Ceritakan fitur tambahan atau target pengguna…"
              className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 focus:border-[#35d6ff] focus:outline-none"
            />
            <button
              type="submit"
              disabled={streaming || !manualInput.trim()}
              className="rounded-xl bg-[#35d6ff] px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-40"
            >
              Kirim
            </button>
          </form>
        </div>
      </div>
      </div>
    );
  }

  // PRD sudah ada: Workspace 3-view lengkap (Wiki | Roadmap | Lihat Task + Workspace Agent + Implemen modal).
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#070a14]">
      {/* Workspace Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-[#0a0f1f]/95 px-4 py-2.5 sm:px-5 print:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-1 text-xs text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            ← Project
          </Link>
          <h1 className="max-w-[200px] truncate text-sm font-semibold text-white sm:max-w-xs">
            {projectTitle}
          </h1>
          <span className="rounded-full border border-[#35d6ff]/40 bg-[#35d6ff]/12 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#7fe3ff]">
            #v{prdVersion}
          </span>
          <span
            title="Otomatis sinkron setiap 3 detik dengan AI agent"
            className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300 sm:inline-flex"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Sync
          </span>
        </div>

        {/* Center View Switcher: Wiki | Roadmap | Lihat Task */}
        <nav
          aria-label="Tampilan workspace PRD"
          className="inline-flex items-center rounded-xl border border-slate-800 bg-slate-950/80 p-1 text-xs"
        >
          {(
            [
              { id: "wiki", label: "Wiki" },
              { id: "roadmap", label: "Roadmap" },
              { id: "tasks", label: `Lihat Task (${tasks.length})` },
            ] as const
          ).map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === "tasks" && view !== "tasks") {
                    setTaskFeatureFilter("ALL");
                  }
                  setView(item.id);
                }}
                className={`rounded-lg px-3 py-1.5 font-medium transition ${
                  active
                    ? "bg-linear-to-r from-[#4f7cff]/25 to-[#35d6ff]/25 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setImplementOpen(true)}
            className="btn-shine inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] px-3.5 py-1.5 text-xs font-semibold text-slate-950 shadow-md shadow-[#35d6ff]/20 transition hover:brightness-110"
          >
            <IconSparkles className="h-3.5 w-3.5" />
            <span>Implemen</span>
          </button>

          <button
            type="button"
            onClick={() => setAgentOpen((v) => !v)}
            aria-expanded={agentOpen}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
              agentOpen
                ? "border-[#35d6ff]/60 bg-[#35d6ff]/15 text-[#7fe3ff]"
                : "border-slate-700/80 bg-slate-900/80 text-slate-300 hover:border-slate-500 hover:text-white"
            }`}
          >
            <IconBot className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Workspace Agent</span>
          </button>
        </div>
      </header>

      {error ? (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-200 print:hidden">
          {error}
        </div>
      ) : null}

      {/* Main Split Body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 overflow-hidden">
          {view === "roadmap" ? (
            <RoadmapCanvas
              projectTitle={projectTitle}
              prd={prd}
              tasks={tasks}
              saving={savingPrd}
              onSavePrd={savePrdContent}
              onToggleTaskDone={toggleTaskDone}
              onOpenWiki={() => setView("wiki")}
              onOpenFeatureTasks={(featureTitle) => {
                setTaskFeatureFilter(featureTitle);
                setView("tasks");
              }}
            />
          ) : view === "wiki" ? (
            <PrdWikiView prd={prd} onSavePrd={savePrdContent} saving={savingPrd} />
          ) : (
            <TaskKanban
              tasks={tasks}
              featureFilter={taskFeatureFilter}
              onFeatureFilterChange={setTaskFeatureFilter}
              onUpdateStatuses={updateTaskStatuses}
            />
          )}
        </div>

        {agentOpen ? (
          <WorkspaceAgent
            messages={messages}
            featureCount={features.length}
            subFeatureCount={subFeatureCount}
            taskCount={tasks.length}
            streaming={streaming}
            streamText={streamText}
            error={error}
            onSend={handleAgentSend}
            onClose={() => setAgentOpen(false)}
          />
        ) : null}
      </div>

      <ImplementModal
        open={implementOpen}
        projectId={project.id}
        projectTitle={projectTitle}
        prd={prd}
        tasks={tasks}
        onClose={() => setImplementOpen(false)}
      />
    </div>
  );
}
