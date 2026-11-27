/**
 * Implementasi TOTP RFC 6238 (6 digit, 30 detik, HMAC-SHA1) memakai `node:crypto`
 * + rendering QR code via `qrcode` untuk aplikasi Autentikator (Google Authenticator,
 * Authy, 1Password, dll.).
 */
import crypto from "node:crypto";
import QRCode from "qrcode";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function encodeBase32(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function decodeBase32(input: string): Buffer {
  const clean = input.replace(/[\s=-]+/g, "").toUpperCase();
  if (!clean) throw new Error("Kunci Base32 TOTP kosong.");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("Kunci Base32 TOTP tidak valid.");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(bytes = 20): string {
  return encodeBase32(crypto.randomBytes(bytes));
}

export function formatTotpSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

export function buildOtpAuthUri(email: string, secret: string, issuer = "MyPRD"): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(email)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function totpCodeAt(secret: string, timestampMs = Date.now(), periodSec = 30): string {
  const key = decodeBase32(secret);
  const counter = BigInt(Math.max(0, Math.floor(timestampMs / 1000 / periodSec)));
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(counter);
  const hmac = crypto.createHmac("sha1", key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(bin % 1_000_000).padStart(6, "0");
}

export function verifyTotpCode(secret: string, code: string, timestampMs = Date.now(), window = 1): boolean {
  const clean = code.trim();
  if (!/^\d{6}$/.test(clean)) return false;
  const candidate = Buffer.from(clean, "utf8");
  let matched = false;
  for (let step = -window; step <= window; step++) {
    const stepMs = timestampMs + step * 30_000;
    if (stepMs < 0) continue;
    const expected = Buffer.from(totpCodeAt(secret, stepMs), "utf8");
    if (crypto.timingSafeEqual(candidate, expected)) {
      matched = true;
    }
  }
  return matched;
}

export async function renderTotpQrDataUrl(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 240,
    color: {
      dark: "#070a14",
      light: "#ffffff",
    },
  });
}
