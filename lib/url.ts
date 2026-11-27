/**
 * Tentukan origin publik (https://domain.tld) di balik reverse proxy (Caddy/Nginx/Cloudflare)
 * agar redirect OAuth dan tautan email tidak pernah jatuh ke http://localhost:3000.
 */
export function publicOrigin(request: Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Abaikan APP_URL yang tidak valid, lanjut ke header request.
    }
  }

  const rawHost = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].trim();
  const safeHost = rawHost && !/[\s/@\\]/.test(rawHost) ? rawHost : "";
  const rawProto = (request.headers.get("x-forwarded-proto") ?? "").split(",")[0].trim().toLowerCase();
  const fallbackOrigin = new URL(request.url).origin;
  const proto = rawProto === "https" || rawProto === "http" ? rawProto : new URL(fallbackOrigin).protocol.replace(":", "");

  if (safeHost) return `${proto}://${safeHost}`;
  return fallbackOrigin;
}

export function publicUrl(request: Request, pathname: string): string {
  return new URL(pathname, publicOrigin(request)).toString();
}
