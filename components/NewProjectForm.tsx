"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DictationButton } from "@/components/DictationButton";
import { getTemplate } from "@/lib/templates";

export interface ModelOption {
  id: string;
  label: string;
  models: { id: string; model: string }[];
}

export function NewProjectForm({ providers, defaultModel }: { providers: ModelOption[]; defaultModel: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [idea, setIdea] = useState("");
  const [modelId, setModelId] = useState(defaultModel);
  const [language, setLanguage] = useState<"id" | "en">("id");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // Prefill dari ?template=<slug> (link "Bikin PRD dengan template").
  // Dijadwalkan via setTimeout agar tidak setState sinkron di dalam effect.
  useEffect(() => {
    const slug = searchParams.get("template");
    if (!slug) return;
    const template = getTemplate(slug);
    if (!template) return;
    const timer = window.setTimeout(() => {
      setTemplateName(template.name);
      setIdea((current) => (current.trim() ? current : `${template.ideaContext}\n\nIde saya: `));
      setOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  function appendDictation(text: string) {
    setIdea((current) => (current.trim() ? `${current.trim()} ${text}` : text));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!idea.trim()) {
      setError("Tulis dulu idemu.");
      return;
    }
    setError("");
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
        return;
      }
      router.push(`/dashboard/${data.project.id}`);
    } catch {
      setError("Tidak bisa menghubungi server.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
      >
        + Bikin PRD Baru
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
      <h2 className="font-semibold">Project baru</h2>
      <p className="mt-1 text-sm text-slate-400">
        Ceritakan idemu bebas — bahasa sehari-hari saja. AI akan bertanya dulu sebelum menyusun PRD.
      </p>

      <label className="mt-4 block text-sm text-slate-300" htmlFor="idea">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span>Ide produk</span>
          <DictationButton onText={appendDictation} />
        </span>
      </label>
      {templateName ? (
        <p className="mt-1 text-xs text-sky-300">
          Memakai template {templateName} — konteks tech stack sudah dimasukkan ke ide.
        </p>
      ) : null}
      <textarea
        id="idea"
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        rows={5}
        maxLength={8000}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-sky-500"
        placeholder="Contoh: aplikasi kasir sederhana untuk warung kopi, bisa catat pesanan dan rekap harian..."
      />

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm text-slate-300" htmlFor="model">
            Model AI
          </label>
          <select
            id="model"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-sky-500"
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
        </div>
        <div>
          <label className="block text-sm text-slate-300" htmlFor="language">
            Bahasa output PRD
          </label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value === "en" ? "en" : "id")}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-sky-500"
          >
            <option value="id">Bahasa Indonesia</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      ) : null}

      <div className="mt-5 flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
        >
          {loading ? "Membuat..." : "Mulai ngobrol"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm text-slate-300 hover:border-slate-500"
        >
          Batal
        </button>
      </div>
    </form>
  );
}
