# Desain: Verifikasi email via OTP

Tanggal: 2026-11-26

## Intent

User ingin kode OTP email wajib dipakai saat:
1. Daftar akun baru (email + password).
2. Akun Google **baru** (first sign-in).
3. Lupa password / reset password.

Login email/password biasa **tidak** minta OTP. Ini keputusan user, bukan verifikasi tiap login.

Selain itu user minta animasi saat memasukkan kode.

## Goals

- Akun baru tidak bisa dipakai sebelum email terverifikasi.
- Kode 6 digit, sekali pakai, kedaluwarsa 10 menit, maks 5 kali salah.
- Tidak ada enumerasi user: response selalu generik.
- Kirim email pakai Resend yang sudah terkonfigurasi (`no-reply@myprd.web.id`).
- UI OTP beranimasi rapi: fokus naik, auto-advance antar kotak, paste 6 digit, goyang merah saat salah, sukses pulse. Aman untuk `prefers-reduced-motion`.

## Non-goals

- OTP pada login email/password yang sudah terdaftar.
- OTP tiap kali Google login (cuma akun baru).
- SMS / WhatsApp OTP.
- Link token reset lama — diganti OTP.

## Constraint

- Next.js 16 App Router, Tailwind 4, TypeScript, `node:sqlite`.
- Tanpa dependency baru (tidak ada library OTP / email / ikon).
- `node:sqlite DatabaseSync` tidak punya `.transaction()` — pakai `BEGIN`/`COMMIT`/`ROLLBACK` eksplisit.
- PowerShell 5.1; `rg` tidak tersedia.

## Approaches

### Cara 1 — Dipilih: satu tabel OTP + flag `email_verified` di `users`
Satu tabel `otp_codes` dipakai untuk daftar, Google baru, dan reset. `users.email_verified` menandai akun aktif. Paling sedikit tabel & kode; akun belum verifikasi otomatis ditolak login.

### Cara 2 — Ditolak: tabel `pending_signups` terpisah
Data pendaftaran ditampung, user dibuat setelah OTP benar. Users table lebih bersih, tapi butuh tabel tambahan + cleanup, hơn banyak kode tanpa manfaat nyata di skala ini.

## Desain teknis

### Database (`lib/db.ts`)
- `users` tambah `email_verified INTEGER NOT NULL DEFAULT 1` (existing user tetap valid).
- Tabel baru `otp_codes`:
  - `id TEXT PK`, `user_id TEXT REFERENCES users(id) ON DELETE CASCADE` (nullable untuk reset sebelum user dikenal? tidak — semua alur punya user),
  - `email TEXT NOT NULL`, `purpose TEXT NOT NULL` (`signup` | `google` | `reset`),
  - `code_hash TEXT NOT NULL`, `created_at INTEGER`, `expires_at INTEGER`, `used_at INTEGER`, `attempts INTEGER NOT NULL DEFAULT 0`.
  - Index `idx_otp_expires`.
- `sweepOtpCodes(db)` hapus expired / used > 24 jam.
- Migrasi aditif `migrateEmailVerified(db)`. Urutan migrasi tetap: password nullable → default model → profile → email verified.

### `lib/otp.ts` (baru)
- `issueOtp(email, purpose, userId): string` — buat 6 digit acak (`randomInt`), simpan SHA256, TTL 10 menit. Sebelum insert, tandai kode lama same email+purpose sebagai used (single active code).
- `verifyOtp(email, purpose, code): {ok:true, userId} | {ok:false, reason}` — cek hash, expiry, used, attempts; inkrement attempts; maks 5; transaksi eksplisit; pada sukses set `used_at` dan (untuk signup/google) `email_verified=1`.
- Pakai `timingSafeEqual` untuk perbandingan hash.

### `lib/email.ts` (baru, ekstraksi)
- `sendEmail({to, subject, html})` — POST `https://api.resend.com/emails`; `from` = `EMAIL_FROM` atau fallback `onboarding@resend.dev`; lempar error bila Resend menolak.
- Dipakai forgot-password + OTP supaya tidak duplikat fetch.
- Dev fallback: kalau tidak ada `RESEND_API_KEY`, log kode/link ke console dan kembalikan `devCode` hanya saat `NODE_ENV !== "production"`.

### Alur

**Daftar** — `POST /api/auth/register`
- Rate limit seperti sekarang. Buat user dengan `email_verified=0`, **jangan** set session.
- `issueOtp(email, "signup", user.id)` + kirim email.
- Response `{ok:true, email}` → client arahkan ke `/verifikasi-otp?email=...`.
- Jika kirim email gagal, hapus user yang baru dibuat (jangan tinggalkan akun tanpa cara verifikasi).

**Verifikasi** — `POST /api/auth/verify-otp` `{email, code, purpose}`
- `verifyOtp`; jika sukses dan purpose signup/google → `setSessionCookie(userId)`; response `{ok:true, next}`.
- Salah → `{ok:false}` generik, sisa attempts tidak dibocorkan.

**Google baru** — `app/api/auth/google/callback/route.ts`
- `findOrCreateOAuthUser` kini mengembalikan `{user, isNew}`.
- Jika `isNew`: issue OTP purpose `google`, kirim email, redirect ke `/verifikasi-otp?email=...&purpose=google` (belum ada session).
- Jika sudah ada: langsung session seperti sekarang.

**Lupa / reset password**
- `POST /api/auth/forgot-password` — tetap generik `{ok:true}`; bila user ada & punya password, issue OTP purpose `reset` + kirim email. Link token dihapus.
- `POST /api/auth/reset-password` — terima `{email, code, newPassword}`; `verifyOtp` purpose `reset`, lalu `hashPassword` + update `password_hash`. Token lama dihapus.
- Halaman `/reset-password` minta email (atau dari query), kode OTP, dan password baru.

### UI / animasi
- `components/OtpInput.tsx` (baru): 6 kotak, `inputMode="numeric"`, auto-advance, backspace mundur, paste 6 digit, arrow keys.
  - Fokus: border cyan + glow (`box-shadow`) + scale 1.03.
  - Digit terisi: naik halus (`otp-pop` 180ms).
  - Salah: goyang (`otp-shake` 360ms) + merah, lalu fokus kotak pertama.
  - Sukses: pulse cyan sebelum redirect.
- `app/verifikasi-otp/page.tsx` — card auth-shell yang sama dengan login, OtpInput + tombol Verifikasi + tautan kirim ulang (rate limited).
- `components/PasswordRecoveryForm.tsx` — mode reset pakai OtpInput + field password baru; animasi sama.
- CSS di `app/globals.css`: keyframe `otp-pop`, `otp-shake`, `otp-success`, utility `.otp-box`, `.otp-box:focus`, `.otp-error`. Semua mati di `prefers-reduced-motion` (sudah ada override global).

### Keamanan
- Kode hash di DB, plaintext hanya di email.
- Rate limit: `otp:${ip}` 5/15 menit untuk issue, `otp-verify:${ip}` 10/5 menit untuk cek.
- Attempts max 5 per kode; kode lama saya used saat kode baru dibuat.
- Response generik; tidak pernah bilang email terdaftar atau tidak.
- Akun `email_verified=0` ditolak di `authenticate` dengan pesan "Verifikasi email dulu".

## Pengujian

- `npm run typecheck`, `npm run lint`, `npm test`.
- Test baru `tests/otp.test.mts`: issue → verify sukses → verify ulang gagal; attempts habis; expiry; kode lama invalid setelah issue baru.
- Browser: daftar user baru → terima OTP (dev: baca log) → verifikasi → masuk dashboard; Google baru tidak bisa diuji tanpa kredensial Google, dicek lewat kode. Lupa password → OTP → password baru → login sukses.

## Yang belum diputuskan / jadi keputusan saya

- `email_verified` default 1 agar user lama tidak terkunci. Ini keputusan saya.
- Dev fallback menampilkan kode di UI hanya saat `NODE_ENV !== "production"` — keputusan saya.
- Reset memakai OTP saja, link token lama dihapus — sesuai konfirmasi user.
