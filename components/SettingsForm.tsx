"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Reveal } from "@/components/motion/Reveal";
import { IconCheck, IconLock, IconMail, IconShield, IconUser } from "./icons";

interface SettingsFormProps {
  initialName: string;
  email: string;
  initialPhone: string;
  initialBio: string;
  initialAvatarUrl: string;
  initialTwoFactorEnabled: boolean;
  initialTwoFactorMethod: "email" | "totp";
  hasPassword: boolean;
}

interface TwoFactorSetupPayload {
  method: "email" | "totp";
  qrDataUrl?: string;
  formattedSecret?: string;
  secret?: string;
  devCode?: string;
}

const inputClass =
  "w-full rounded-xl border border-slate-700/80 bg-[#060912] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-[#35d6ff] focus:shadow-[0_0_0_3px_rgba(53,214,255,0.14)]";

async function resizeAvatarToDataUrl(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Format foto harus PNG, JPG, atau WebP.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Ukuran file foto maksimal 5 MB.");
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("File gambar tidak dapat dibaca."));
      el.src = objectUrl;
    });
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Browser tidak mendukung pemrosesan gambar.");

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const side = Math.min(w, h);
    ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);

    for (const quality of [0.85, 0.72, 0.58]) {
      const webp = canvas.toDataURL("image/webp", quality);
      if (webp.startsWith("data:image/webp") && webp.length <= 180_000) return webp;
      const jpeg = canvas.toDataURL("image/jpeg", quality);
      if (jpeg.length <= 180_000) return jpeg;
    }
    throw new Error("Ukuran foto masih terlalu besar setelah dikompres. Pilih gambar lain.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function SettingsForm({
  initialName,
  email,
  initialPhone,
  initialBio,
  initialAvatarUrl,
  initialTwoFactorEnabled,
  initialTwoFactorMethod,
  hasPassword,
}: SettingsFormProps) {
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [bio, setBio] = useState(initialBio);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(initialTwoFactorEnabled);
  const [twoFactorMethod, setTwoFactorMethod] = useState<"email" | "totp">(initialTwoFactorMethod);
  const [tfaSetupMethod, setTfaSetupMethod] = useState<"email" | "totp">(initialTwoFactorMethod);
  const [tfaSetupData, setTfaSetupData] = useState<TwoFactorSetupPayload | null>(null);
  const [tfaCode, setTfaCode] = useState("");
  const [tfaSecretCopied, setTfaSecretCopied] = useState(false);
  const [tfaPassword, setTfaPassword] = useState("");
  const [tfaConfirmDisable, setTfaConfirmDisable] = useState(false);
  const [tfaBusy, setTfaBusy] = useState(false);
  const [tfaMessage, setTfaMessage] = useState("");
  const [tfaError, setTfaError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState("");
  const [pwError, setPwError] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const initial = (name || email).trim().charAt(0).toUpperCase();

  async function saveAvatar(nextAvatarUrl: string) {
    setAvatarBusy(true);
    setAvatarError("");
    setAvatarMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: nextAvatarUrl }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui foto profil.");
      setAvatarUrl(nextAvatarUrl);
      setAvatarMessage(nextAvatarUrl ? "Foto profil berhasil diperbarui." : "Foto profil dihapus.");
      router.refresh();
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Gagal memperbarui foto profil.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAvatarError("");
    setAvatarMessage("");
    setAvatarBusy(true);
    try {
      const dataUrl = await resizeAvatarToDataUrl(file);
      await saveAvatar(dataUrl);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Gagal memproses foto.");
      setAvatarBusy(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, bio }),
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

  async function startTwoFactorSetup(methodOverride?: "email" | "totp") {
    const method = methodOverride ?? tfaSetupMethod;
    setTfaBusy(true);
    setTfaError("");
    setTfaMessage("");
    setTfaSecretCopied(false);
    try {
      const res = await fetch("/api/settings/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const data = (await res.json().catch(() => ({}))) as TwoFactorSetupPayload & { error?: string };
      if (!res.ok) throw new Error(data.error || "Gagal memulai aktivasi 2FA.");
      setTfaSetupMethod(method);
      setTfaSetupData({
        method,
        qrDataUrl: data.qrDataUrl,
        formattedSecret: data.formattedSecret,
        secret: data.secret,
        devCode: data.devCode,
      });
      setTfaCode("");
      if (method === "email") {
        setTfaMessage("Kode aktivasi 6 digit sudah dikirim ke emailmu.");
      }
    } catch (err) {
      setTfaError(err instanceof Error ? err.message : "Gagal memulai aktivasi 2FA.");
    } finally {
      setTfaBusy(false);
    }
  }

  async function confirmEnableTwoFactor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tfaSetupData) return;
    setTfaBusy(true);
    setTfaError("");
    setTfaMessage("");
    try {
      const res = await fetch("/api/settings/2fa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true, method: tfaSetupData.method, code: tfaCode }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Kode autentikasi tidak valid.");
      setTwoFactorEnabled(true);
      setTwoFactorMethod(tfaSetupData.method);
      setTfaSetupData(null);
      setTfaCode("");
      setTfaMessage(
        tfaSetupData.method === "totp"
          ? "2FA aktif lewat Aplikasi Autentikator."
          : "2FA aktif lewat OTP Email.",
      );
      router.refresh();
    } catch (err) {
      setTfaError(err instanceof Error ? err.message : "Gagal memverifikasi kode 2FA.");
    } finally {
      setTfaBusy(false);
    }
  }

  async function disableTwoFactor(password?: string) {
    setTfaBusy(true);
    setTfaError("");
    setTfaMessage("");
    try {
      const res = await fetch("/api/settings/2fa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Gagal menonaktifkan 2FA.");
      setTwoFactorEnabled(false);
      setTwoFactorMethod("email");
      setTfaSetupData(null);
      setTfaConfirmDisable(false);
      setTfaPassword("");
      setTfaMessage("2FA dinonaktifkan.");
      router.refresh();
    } catch (err) {
      setTfaError(err instanceof Error ? err.message : "Gagal menonaktifkan 2FA.");
    } finally {
      setTfaBusy(false);
    }
  }

  async function copyTotpSecret() {
    if (!tfaSetupData?.secret) return;
    try {
      await navigator.clipboard.writeText(tfaSetupData.secret);
      setTfaSecretCopied(true);
      window.setTimeout(() => setTfaSecretCopied(false), 2000);
    } catch {
      // Abaikan clipboard error.
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

  async function handleDeleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/settings/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteConfirm, password: deletePassword }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Gagal menghapus akun.");
      router.replace("/");
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Gagal menghapus akun.");
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Reveal>
          <section className="rounded-2xl border border-slate-800/90 bg-[#0b1022]/80 p-6">
            <div className="mb-5 flex items-center gap-2">
              <IconUser className="h-4 w-4 text-[#35d6ff]" />
              <h2 className="text-sm font-semibold text-white">Profil</h2>
            </div>

            {/* Foto Profil */}
            <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-slate-800/80 bg-[#060912]/70 p-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-linear-to-br from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] text-xl font-bold text-slate-950">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={name || email}
                    width={64}
                    height={64}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initial
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white">Foto profil</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  PNG, JPG, atau WebP. Otomatis dipotong kotak dan dikompres.
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={avatarBusy}
                    onClick={() => avatarInputRef.current?.click()}
                    className="rounded-lg border border-[#35d6ff]/40 bg-[#35d6ff]/10 px-3 py-1.5 text-xs font-medium text-[#7fe3ff] transition hover:bg-[#35d6ff]/20 disabled:opacity-50"
                  >
                    {avatarBusy ? "Mengunggah..." : "Ganti foto"}
                  </button>
                  {avatarUrl ? (
                    <button
                      type="button"
                      disabled={avatarBusy}
                      onClick={() => void saveAvatar("")}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-rose-400/50 hover:text-rose-200 disabled:opacity-50"
                    >
                      Hapus foto
                    </button>
                  ) : null}
                </div>
                {avatarError ? (
                  <p role="alert" className="mt-2 text-xs text-rose-300">
                    {avatarError}
                  </p>
                ) : null}
                {avatarMessage ? (
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-300">
                    <IconCheck className="h-3.5 w-3.5" /> {avatarMessage}
                  </p>
                ) : null}
              </div>
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
                  <IconMail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    id="settings-email"
                    value={email}
                    readOnly
                    disabled
                    className="w-full cursor-not-allowed rounded-xl border border-slate-800 bg-slate-950/60 py-2.5 pr-3 pl-10 text-sm text-slate-400"
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
        </Reveal>

        <AnimatePresence>
          {error ? (
            <motion.p
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
            >
              {error}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-auto sm:min-w-48">
            <SubmitButton
              status={saving ? "loading" : saved ? "success" : "idle"}
              idleLabel="Simpan perubahan"
              loadingLabel="Menyimpan..."
              successLabel="Tersimpan"
            />
          </div>
          {saved ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-300">
              <IconCheck className="h-4 w-4" /> Perubahan tersimpan
            </span>
          ) : null}
        </div>
      </form>

      {/* Autentikasi Dua Faktor (2FA) */}
      <Reveal delay={0.08}>
        <section className="rounded-2xl border border-slate-800/90 bg-[#0b1022]/80 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <IconShield className="h-4 w-4 text-[#35d6ff]" />
                <h2 className="text-sm font-semibold text-white">Autentikasi Dua Faktor (2FA)</h2>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    twoFactorEnabled
                      ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
                      : "border-slate-700 bg-slate-900 text-slate-400"
                  }`}
                >
                  {twoFactorEnabled
                    ? twoFactorMethod === "totp"
                      ? "Aktif · Aplikasi Autentikator"
                      : "Aktif · OTP Email"
                    : "Nonaktif"}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Setiap masuk lewat email atau Google wajib verifikasi kode 6 digit (via Aplikasi Autentikator atau OTP
                Email). Gagal 5 kali berturut-turut otomatis mengunci verifikasi selama 24 jam.
              </p>
            </div>

            {twoFactorEnabled && !tfaConfirmDisable ? (
              <button
                type="button"
                disabled={tfaBusy}
                onClick={() => {
                  if (!hasPassword) {
                    void disableTwoFactor();
                  } else {
                    setTfaConfirmDisable(true);
                    setTfaError("");
                    setTfaMessage("");
                  }
                }}
                className="rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:border-rose-400/50 hover:text-rose-200 disabled:opacity-50"
              >
                Nonaktifkan 2FA
              </button>
            ) : null}
          </div>

          {!twoFactorEnabled && !tfaSetupData ? (
            <div className="mt-4 space-y-3 rounded-xl border border-slate-800 bg-[#060912]/70 p-4">
              <p className="text-xs font-medium text-slate-300">Pilih metode verifikasi 2FA:</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {(
                  [
                    {
                      id: "totp",
                      title: "Aplikasi Autentikator",
                      desc: "Scan QR code atau masukkan kunci rahasia di Google Authenticator / Authy / 1Password.",
                    },
                    {
                      id: "email",
                      title: "Kode OTP Email",
                      desc: `Kirim kode 6 digit ke ${email} setiap kali login.`,
                    },
                  ] as const
                ).map((opt) => {
                  const selected = tfaSetupMethod === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTfaSetupMethod(opt.id)}
                      className={`rounded-xl border p-3 text-left transition ${
                        selected
                          ? "border-[#35d6ff]/70 bg-[#35d6ff]/10"
                          : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                      }`}
                    >
                      <p className="text-xs font-semibold text-white">{opt.title}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={tfaBusy}
                onClick={() => void startTwoFactorSetup()}
                className="rounded-xl bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] px-4 py-2 text-xs font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50"
              >
                {tfaBusy
                  ? "Menyiapkan..."
                  : tfaSetupMethod === "totp"
                    ? "Buat QR & Kunci Autentikator"
                    : "Kirim Kode Verifikasi ke Email"}
              </button>
            </div>
          ) : null}

          {!twoFactorEnabled && tfaSetupData ? (
            <form
              onSubmit={confirmEnableTwoFactor}
              className="mt-4 space-y-4 rounded-xl border border-[#35d6ff]/30 bg-[#060912]/80 p-4"
            >
              {tfaSetupData.method === "totp" && tfaSetupData.qrDataUrl ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="shrink-0 self-start rounded-2xl bg-white p-2.5 shadow-md">
                    <Image
                      src={tfaSetupData.qrDataUrl}
                      alt="QR Code Aplikasi Autentikator MyPRD"
                      width={160}
                      height={160}
                      unoptimized
                      className="h-40 w-40"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2.5 text-xs">
                    <p className="font-semibold text-white">1. Scan QR Code atau masukkan kunci secara manual</p>
                    <p className="leading-relaxed text-slate-400">
                      Buka Google Authenticator, Authy, 1Password, atau aplikasi TOTP lainnya lalu scan QR code ini.
                    </p>
                    {tfaSetupData.formattedSecret ? (
                      <div className="rounded-xl border border-slate-800 bg-slate-950/90 p-2.5">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">Kunci rahasia manual</p>
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                          <code className="font-mono text-xs tracking-wider text-[#7fe3ff] break-all">
                            {tfaSetupData.formattedSecret}
                          </code>
                          <button
                            type="button"
                            onClick={() => void copyTotpSecret()}
                            className="shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-[#35d6ff]/60 hover:text-white"
                          >
                            {tfaSecretCopied ? "Tersalin!" : "Salin kunci"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-white">Cek inbox emailmu</p>
                  <p className="text-slate-400">
                    Masukkan kode 6 digit yang dikirim ke <span className="text-slate-200">{email}</span> untuk
                    mengaktifkan 2FA.
                  </p>
                  {tfaSetupData.devCode ? (
                    <p className="text-slate-500">
                      Mode dev — kode: <span className="font-mono text-[#35d6ff]">{tfaSetupData.devCode}</span>
                    </p>
                  ) : null}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label htmlFor="tfa-verify-code" className="mb-1.5 block text-xs font-medium text-slate-300">
                    {tfaSetupData.method === "totp"
                      ? "2. Masukkan kode 6 digit dari aplikasi Autentikator"
                      : "Masukkan kode verifikasi 6 digit"}
                  </label>
                  <input
                    id="tfa-verify-code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={tfaCode}
                    onChange={(e) => setTfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    className={`${inputClass} font-mono tracking-[0.28em]`}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={tfaBusy || tfaCode.length !== 6}
                    className="rounded-xl bg-linear-to-r from-[#4f7cff] via-[#35d6ff] to-[#a78bfa] px-4 py-2.5 text-xs font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50"
                  >
                    {tfaBusy ? "Memverifikasi..." : "Verifikasi & Aktifkan 2FA"}
                  </button>
                  {tfaSetupData.method === "email" ? (
                    <button
                      type="button"
                      disabled={tfaBusy}
                      onClick={() => void startTwoFactorSetup("email")}
                      className="rounded-xl border border-slate-700 px-3 py-2.5 text-xs text-slate-300 hover:text-white disabled:opacity-50"
                    >
                      Kirim ulang
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={tfaBusy}
                    onClick={() => {
                      setTfaSetupData(null);
                      setTfaCode("");
                      setTfaError("");
                      setTfaMessage("");
                    }}
                    className="rounded-xl border border-slate-700 px-3 py-2.5 text-xs text-slate-300 hover:text-white"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </form>
          ) : null}

          {tfaConfirmDisable && twoFactorEnabled && hasPassword ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void disableTwoFactor(tfaPassword);
              }}
              className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#060912]/70 p-4 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <label htmlFor="tfa-disable-password" className="mb-1.5 block text-xs font-medium text-slate-400">
                  Masukkan password akun untuk menonaktifkan 2FA
                </label>
                <input
                  id="tfa-disable-password"
                  type="password"
                  required
                  value={tfaPassword}
                  onChange={(e) => setTfaPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={tfaBusy}
                  className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-3.5 py-2.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/25 disabled:opacity-50"
                >
                  {tfaBusy ? "Memproses..." : "Konfirmasi"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTfaConfirmDisable(false);
                    setTfaPassword("");
                  }}
                  className="rounded-xl border border-slate-700 px-3 py-2.5 text-xs text-slate-300 hover:text-white"
                >
                  Batal
                </button>
              </div>
            </form>
          ) : null}

          {tfaError ? (
            <p role="alert" className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {tfaError}
            </p>
          ) : null}
          {tfaMessage ? (
            <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-300">
              <IconCheck className="h-4 w-4" /> {tfaMessage}
            </p>
          ) : null}
        </section>
      </Reveal>

      <Reveal delay={0.1}>
        <form onSubmit={handlePassword} className="rounded-2xl border border-slate-800/90 bg-[#0b1022]/80 p-6">
          <div className="mb-1 flex items-center gap-2">
            <IconLock className="h-4 w-4 text-[#35d6ff]" />
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
                <p role="alert" className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {pwError}
                </p>
              ) : null}
              {pwMessage ? (
                <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-emerald-300">
                  <IconCheck className="h-4 w-4" /> {pwMessage}
                </p>
              ) : null}
              <div className="mt-4 sm:w-48">
                <SubmitButton
                  status={pwSaving ? "loading" : pwMessage ? "success" : "idle"}
                  idleLabel="Ganti password"
                  loadingLabel="Mengganti..."
                  successLabel="Diganti"
                />
              </div>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-slate-400">
              Akun ini terdaftar lewat Google. Password tidak tersedia — gunakan tombol Masuk dengan Google.
            </p>
          )}
        </form>
      </Reveal>

      {/* Zona Berbahaya: Hapus Akun */}
      <Reveal delay={0.14}>
        <section className="rounded-2xl border border-rose-500/30 bg-rose-950/10 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-rose-200">Hapus akun</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Menghapus akun bersifat permanen: seluruh project, PRD, riwayat chat, dan transaksi akan ikut terhapus
                dan tidak bisa dikembalikan.
              </p>
            </div>
            {!deleteOpen ? (
              <button
                type="button"
                onClick={() => {
                  setDeleteOpen(true);
                  setDeleteError("");
                }}
                className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-3.5 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/25"
              >
                Hapus akun permanen
              </button>
            ) : null}
          </div>

          {deleteOpen ? (
            <form onSubmit={handleDeleteAccount} className="mt-4 space-y-3 rounded-xl border border-rose-500/25 bg-[#060912]/80 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="delete-confirm" className="mb-1.5 block text-xs font-medium text-slate-300">
                    Ketik <span className="font-mono font-bold text-rose-300">HAPUS</span> untuk konfirmasi
                  </label>
                  <input
                    id="delete-confirm"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="HAPUS"
                    required
                    className={inputClass}
                  />
                </div>
                {hasPassword ? (
                  <div>
                    <label htmlFor="delete-password" className="mb-1.5 block text-xs font-medium text-slate-300">
                      Password akun
                    </label>
                    <input
                      id="delete-password"
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      required
                      className={inputClass}
                    />
                  </div>
                ) : null}
              </div>

              {deleteError ? (
                <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {deleteError}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={deleteBusy || deleteConfirm.trim().toUpperCase() !== "HAPUS"}
                  className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleteBusy ? "Menghapus akun..." : "Ya, hapus akun saya"}
                </button>
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeleteConfirm("");
                    setDeletePassword("");
                    setDeleteError("");
                  }}
                  className="rounded-xl border border-slate-700 px-3.5 py-2 text-xs text-slate-300 hover:text-white"
                >
                  Batal
                </button>
              </div>
            </form>
          ) : null}
        </section>
      </Reveal>
    </div>
  );
}
