import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit } from "./lib/rate-limit";

// Proxy berjalan sebelum request sampai ke Route Handler.
// Di sini kita tambahkan lapisan rate-limit untuk /api/login & /api/register
// agar attacker tidak bisa bypass proxy /api/auth/* dan menghantam backend langsung.
// Tanpa ubah file app/(backend) sama sekali.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Hanya lindungi endpoint auth yang rawan brute-force / spam
  const isAuthRoute =
    pathname === "/api/login" ||
    pathname === "/api/register" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/register";

  if (isAuthRoute) {
    // Rate-limit per IP + path (3 req/menit, sama dengan lib/rate-limit)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";

    const key = `${pathname}:${ip}`;
    if (!checkRateLimit(key)) {
      return NextResponse.json(
        { status: "error", message: "Terlalu banyak percobaan. Tunggu 1 menit." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    // Tolak payload raksasa (8KB) sebelum sampai ke handler — cegah DoS
    const len = request.headers.get("content-length");
    if (len && Number(len) > 8 * 1024) {
      return NextResponse.json(
        { status: "error", message: "Payload terlalu besar" },
        { status: 413 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/login", "/api/register", "/api/auth/:path*"],
};
