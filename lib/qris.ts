import QRCode from "qrcode";
import { BillingError } from "./billing.ts";

export interface EmvTag {
  tag: string;
  value: string;
}

export interface QrisMerchantInfo {
  merchantName: string;
  merchantCity: string;
  nmid: string;
}

export interface QrisOrderMetadata {
  payload: string;
  confirmedAt?: number;
  note?: string;
}

const STATIC_TAG_STRIP = new Set(["54", "55", "56", "57", "63"]);

export function qrisStaticPayload(): string {
  return (process.env.QRIS_STATIC_PAYLOAD ?? "").trim();
}

/** Hitung checksum CRC-16/CCITT-FALSE (init 0xFFFF, poly 0x1021) sesuai standar EMVCo QRIS. */
export function crc16Ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function parseEmvTags(payload: string): EmvTag[] {
  const tags: EmvTag[] = [];
  let cursor = 0;
  while (cursor < payload.length) {
    if (cursor + 4 > payload.length) {
      throw new BillingError("Format string QRIS tidak lengkap (header TLV terpotong).", 400);
    }
    const tag = payload.slice(cursor, cursor + 2);
    const lenStr = payload.slice(cursor + 2, cursor + 4);
    if (!/^\d{2}$/.test(lenStr)) {
      throw new BillingError(`Panjang tag QRIS "${tag}" tidak valid.`, 400);
    }
    const len = Number(lenStr);
    const start = cursor + 4;
    const end = start + len;
    if (end > payload.length) {
      throw new BillingError(`Nilai tag QRIS "${tag}" terpotong.`, 400);
    }
    tags.push({ tag, value: payload.slice(start, end) });
    cursor = end;
  }
  return tags;
}

function encodeEmvTag(tag: string, value: string): string {
  return `${tag}${String(value.length).padStart(2, "0")}${value}`;
}

export function verifyQrisCrc(payload: string): boolean {
  const clean = payload.trim();
  if (clean.length < 12 || !clean.startsWith("000201")) return false;
  const idx = clean.lastIndexOf("6304");
  if (idx < 0 || idx + 8 !== clean.length) return false;
  try {
    parseEmvTags(clean);
  } catch {
    return false;
  }
  const bodyWithTag63Header = clean.slice(0, idx + 4);
  const actual = clean.slice(idx + 4).toUpperCase();
  return crc16Ccitt(bodyWithTag63Header) === actual;
}

export function extractQrisMerchant(payload: string): QrisMerchantInfo {
  let merchantName = "Merchant QRIS";
  let merchantCity = "";
  let nmid = "";

  try {
    const root = parseEmvTags(payload.trim());
    for (const item of root) {
      if (item.tag === "59" && item.value.trim()) merchantName = item.value.trim();
      if (item.tag === "60" && item.value.trim()) merchantCity = item.value.trim();
      if (item.tag === "51") {
        try {
          for (const sub of parseEmvTags(item.value)) {
            if (sub.tag === "02" && sub.value.trim()) nmid = sub.value.trim();
          }
        } catch {
          // Abaikan subtag 51 bila non-standar.
        }
      }
    }
  } catch {
    // Fallback ke nilai default bila payload parsial.
  }

  return { merchantName, merchantCity, nmid };
}

/**
 * Konversi QRIS statis (tag 01 = "11") menjadi QRIS dinamis (tag 01 = "12")
 * dengan nominal IDR spesifik di tag 54 dan recalculation CRC tag 63.
 */
export function createDynamicQris(staticPayload: string, amountIdr: number): string {
  const clean = staticPayload.trim();
  if (!verifyQrisCrc(clean)) {
    throw new BillingError("Payload QRIS statis tidak valid (CRC/TLV gagal).", 400);
  }
  if (!Number.isInteger(amountIdr) || amountIdr < 1 || amountIdr > 100_000_000) {
    throw new BillingError("Nominal QRIS harus bilangan bulat antara Rp1 hingga Rp100.000.000.", 400);
  }

  const tags = parseEmvTags(clean).filter((t) => !STATIC_TAG_STRIP.has(t.tag));
  const amountStr = String(amountIdr);
  const out: EmvTag[] = [];
  let insertedAmount = false;

  for (const item of tags) {
    if (item.tag === "01") {
      out.push({ tag: "01", value: "12" });
      continue;
    }
    out.push(item);
    if (item.tag === "53") {
      out.push({ tag: "54", value: amountStr });
      insertedAmount = true;
    }
  }

  if (!insertedAmount) {
    out.push({ tag: "54", value: amountStr });
  }

  const body = `${out.map((t) => encodeEmvTag(t.tag, t.value)).join("")}6304`;
  return `${body}${crc16Ccitt(body)}`;
}

const QR_OPTIONS = {
  errorCorrectionLevel: "M" as const,
  margin: 2,
  width: 320,
  color: {
    dark: "#070a14",
    light: "#ffffff",
  },
};

export async function renderQrisSvg(payload: string): Promise<string> {
  return QRCode.toString(payload, { ...QR_OPTIONS, type: "svg" });
}

export async function renderQrisDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, { ...QR_OPTIONS, type: "image/png" });
}

export function parseQrisOrderRef(raw: string): QrisOrderMetadata {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { payload: "" };
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<QrisOrderMetadata>;
      return {
        payload: typeof parsed.payload === "string" ? parsed.payload : "",
        confirmedAt: typeof parsed.confirmedAt === "number" ? parsed.confirmedAt : undefined,
        note: typeof parsed.note === "string" ? parsed.note : undefined,
      };
    } catch {
      return { payload: "" };
    }
  }
  return { payload: trimmed };
}
