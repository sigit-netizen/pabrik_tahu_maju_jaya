import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

// Route ini adalah PROXY yang berjalan di SERVER.
// Browser memanggil /api/auth/login TANPA header x-api-key.
// Server di sini yang menyuntikkan API_SECRET_KEY ke /api/login,
// sehingga secret TIDAK PERNAH masuk ke bundle JS / terlihat di DevTools.
export const dynamic = "force-dynamic";

// Batasi body agar tidak bisa dipakai untuk DoS (8KB cukup untuk email+password)
const MAX_BODY_BYTES = 8 * 1024;

function getSafeOrigin(): string {
  // JANGAN pakai req.nextUrl.origin — itu diambil dari header Host yang bisa dipalsu
  // attacker dan membuat secret bocor ke evil.com (SSRF). Pakai origin terpercaya.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const port = process.env.PORT || "3000";
  return `http://127.0.0.1:${port}`;
}

export async function POST(req: NextRequest) {
  // Rate-limit per IP (3 req/menit) — lapisan tambahan selain backend
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "127.0.0.1";
  if (!checkRateLimit(`auth-login:${ip}`)) {
    return NextResponse.json(
      { status: "error", message: "Terlalu banyak percobaan. Tunggu 1 menit." },
      { status: 429 }
    );
  }

  // Tolak body terlalu besar
  const len = req.headers.get("content-length");
  if (len && Number(len) > MAX_BODY_BYTES) {
    return NextResponse.json({ status: "error", message: "Payload terlalu besar" }, { status: 413 });
  }

  const secret = process.env.API_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { status: "error", message: "Server misconfiguration: API_SECRET_KEY hilang" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ status: "error", message: "Payload terlalu besar" }, { status: 413 });
    }
    body = text ? JSON.parse(text) : {};
    // Validasi minimal agar tidak forward sampah ke backend
    if (typeof body !== "object" || body === null) throw new Error("invalid");
  } catch {
    return NextResponse.json({ status: "error", message: "Body JSON tidak valid" }, { status: 400 });
  }

  try {
    const target = `${getSafeOrigin()}/api/login`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": secret,
      // Forward IP agar rate-limit backend (jika diaktifkan) tetap akurat
      "x-forwarded-for": ip,
    };

    const res = await fetch(target, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await res.text();
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      if (json.data && typeof json.data === "object" && !Array.isArray(json.data)) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _pw, ...rest } = json.data as Record<string, unknown>;
        json.data = rest;
      }
      if (json.details) delete json.details;
      return NextResponse.json(json, { status: res.status });
    } catch {
      return new NextResponse(text, {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch {
    console.error("[auth/login proxy] fetch failed");
    return NextResponse.json({ status: "error", message: "Gagal menghubungi backend" }, { status: 502 });
  }
}
