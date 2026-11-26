/**
 * Rate limiting in-memory (sliding window).
 *
 * Cukup untuk deployment single-node / self-hosted MVP. Kalau nanti di-scale
 * horizontal, ganti implementasinya dengan Redis tanpa mengubah pemanggil.
 */
interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  limit: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  // Pembersihan selalu jalan, termasuk saat request diblokir: kalau hanya di
  // jalur "allowed", penyerang yang terus kena limit tidak pernahapus bucket
  // dan map tumbuh tanpa batas.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.hits.length === 0 || now - v.hits[v.hits.length - 1] > windowMs * 4) buckets.delete(k);
    }
  }

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)),
      limit,
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);

  return { allowed: true, remaining: limit - bucket.hits.length, retryAfterSec: 0, limit };
}

/** Batas default untuk endpoint AI: 20 request / menit per user. */
export const AI_RATE_LIMIT = { limit: 20, windowMs: 60_000 };
/** Batas untuk endpoint auth: 10 percobaan / 5 menit per IP. */
export const AUTH_RATE_LIMIT = { limit: 10, windowMs: 5 * 60_000 };

/**
 * IP klien dari header proxy. `X-Forwarded-For` bisa berisi daftar
 * ("klien, proxy1, ...") — ambil entri pertama supaya kunci rate limit stabil
 * (tanpa ini, satu klien bisa dihitung sebagai beberapa bucket).
 */
export function clientIp(request: Request): string {
  const first = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  return first || "local";
}
