import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

/**
 * Proxy (pengganti middleware di Next 16) untuk cek optimistis halaman privat.
 *
 * Di sini hanya dicek keberadaan cookie sesi — bukan verifikasi tanda tangan —
 * karena Proxy berjalan di runtime yang tidak punya akses `node:sqlite`.
 * Verifikasi sesungguhnya dilakukan di server component / route handler
 * lewat `requireUser()`.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const { pathname } = request.nextUrl;

  if (
    !hasSession &&
    (pathname.startsWith("/dashboard") || pathname.startsWith("/billing") || pathname.startsWith("/settings"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (hasSession && (pathname === "/login" || pathname === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/billing/:path*", "/settings", "/login", "/register"],
};
