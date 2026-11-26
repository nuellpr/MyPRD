import { findUserByEmail } from "@/lib/auth";
import { hashPassword } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { errorToResponse, jsonError, jsonOk, readJson } from "@/lib/http";
import { verifyOtp } from "@/lib/otp";

/** Pasang password baru memakai kode OTP dari email. */
export async function POST(request: Request) {
  try {
    const body = await readJson<{ email?: unknown; code?: unknown; newPassword?: unknown }>(request);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (!email || !code) return jsonError("Kode OTP tidak valid.", 400);
    if (newPassword.length < 8) return jsonError("Password baru minimal 8 karakter.", 400);
    const userId = verifyOtp(email, "reset", code);
    const user = findUserByEmail(email);
    if (!user || user.id !== userId || !user.password_hash) {
      return jsonError("Kode OTP tidak valid.", 400);
    }
    getDb().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(newPassword), userId);
    return jsonOk({ ok: true });
  } catch (error) {
    return errorToResponse(error);
  }
}
