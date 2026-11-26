"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ModelOption } from "./NewProjectForm";
import { IconBot, IconCheck, IconLock, IconMail, IconUser } from "./icons";

interface SettingsFormProps {
  initialName: string;
  email: string;
  initialPhone: string;
  initialBio: string;
  hasPassword: boolean;
  providers: ModelOption[];
  defaultModel: string;
}

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none transition focus:border-sky-500";

export function SettingsForm({
  initialName,
  email,
  initialPhone,
  initialBio,
  hasPassword,
  providers,
  defaultModel,
}: SettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [bio, setBio] = useState(initialBio);
  const [modelId, setModelId] = useState(defaultModel);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState("");
  const [pwError, setPwError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, bio, defaultModelId: modelId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan pengaturan.");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan pengaturan.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPwSaving(true);
    setPwMessage("");
    setPwError("");
    try {
      const res = await fetch("/api/settings/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Gagal mengganti password.");
      setPwMessage("Password berhasil diganti.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Gagal mengganti password.");
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="mb-5 flex items-center gap-2">
            <IconUser className="h-4 w-4 text-sky-300" />
            <h2 className="text-sm font-semibold text-white">Profil</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="settings-name" className="mb-1.5 block text-xs font-medium text-slate-400">
                Nama
              </label>
              <input
                id="settings-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setSaved(false);
                }}
                maxLength={80}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="settings-email" className="mb-1.5 block text-xs font-medium text-slate-400">
                Email
              </label>
              <div className="relative">
                <IconMail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="settings-email"
                  value={email}
                  readOnly
                  disabled
                  className="w-full cursor-not-allowed rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 pl-10 pr-3 text-sm text-slate-400"
                />
              </div>
            </div>
            <div>
              <label htmlFor="settings-phone" className="mb-1.5 block text-xs font-medium text-slate-400">
                No. telepon
              </label>
              <input
                id="settings-phone"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setSaved(false);
                }}
                maxLength={40}
                placeholder="Contoh: 08123456789"
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="settings-bio" className="mb-1.5 block text-xs font-medium text-slate-400">
                Bio
              </label>
              <textarea
                id="settings-bio"
                value={bio}
                onChange={(event) => {
                  setBio(event.target.value);
                  setSaved(false);
                }}
                maxLength={300}
                rows={3}
                placeholder="Ceritakan sedikit tentang dirimu..."
                className={inputClass}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="mb-1 flex items-center gap-2">
            <IconBot className="h-4 w-4 text-sky-300" />
            <h2 className="text-sm font-semibold text-white">Model AI default</h2>
          </div>
          <p className="mb-4 text-xs leading-relaxed text-slate-400">
            Dipakai untuk project baru. Kamu tetap bisa ganti model per project di workspace.
          </p>
          <label htmlFor="settings-model" className="sr-only">
            Model AI default
          </label>
          <select
            id="settings-model"
            value={modelId}
            onChange={(event) => {
              setModelId(event.target.value);
              setSaved(false);
            }}
            className={inputClass}
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
          {providers.length === 1 && providers[0].id === "mock" ? (
            <p className="mt-2 text-xs text-amber-300/80">
              Belum ada API key provider. Tambahkan di <code className="text-amber-200">.env</code> untuk memakai model lain.
            </p>
          ) : null}
        </section>

        {error ? (
          <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn-shine rounded-lg bg-linear-to-r from-sky-500 to-violet-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-60"
          >
            {saving ? "Menyimpan..." : "Simpan perubahan"}
          </button>
          {saved ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-300">
              <IconCheck className="h-4 w-4" /> Tersimpan
            </span>
          ) : null}
        </div>
      </form>

      <form onSubmit={handlePassword} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="mb-1 flex items-center gap-2">
          <IconLock className="h-4 w-4 text-sky-300" />
          <h2 className="text-sm font-semibold text-white">Ganti password</h2>
        </div>
        {hasPassword ? (
          <>
            <p className="mb-4 text-xs leading-relaxed text-slate-400">
              Masukkan password lama, lalu password baru minimal 8 karakter.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="current-password" className="mb-1.5 block text-xs font-medium text-slate-400">
                  Password lama
                </label>
                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="new-password" className="mb-1.5 block text-xs font-medium text-slate-400">
                  Password baru
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  className={inputClass}
                />
              </div>
            </div>
            {pwError ? (
              <p role="alert" className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {pwError}
              </p>
            ) : null}
            {pwMessage ? (
              <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-emerald-300">
                <IconCheck className="h-4 w-4" /> {pwMessage}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pwSaving}
              className="btn-shine mt-4 rounded-lg bg-linear-to-r from-sky-500 to-violet-400 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-60"
            >
              {pwSaving ? "Mengganti..." : "Ganti password"}
            </button>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-slate-400">
            Akun ini terdaftar lewat Google. Password tidak tersedia — gunakan tombol Masuk dengan Google.
          </p>
        )}
      </form>
    </div>
  );
}
