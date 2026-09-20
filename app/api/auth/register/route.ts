import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

// PROXY server-side untuk register: browser -> /api/auth/register -> server
// menyuntikkan API_SECRET_KEY -> /api/register. Secret tetap di server.
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;

function getSafeOrigin(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const port = process.env.PORT || "3000";
  return `http://127.0.0.1:${port}`;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "127.0.0.1";
  if (!checkRateLimit(`auth-register:${ip}`)) {
    return NextResponse.json(
      { status: "error", message: "Terlalu banyak percobaan. Tunggu 1 menit." },
      { status: 429 }
    );
  }

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
    if (typeof body !== "object" || body === null) throw new Error("invalid");
  } catch {
    return NextResponse.json({ status: "error", message: "Body JSON tidak valid" }, { status: 400 });
  }

  try {
    const target = `${getSafeOrigin()}/api/register`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": secret,
      "x-forwarded-for": ip,
    };

    const res = await fetch(target, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await res.text();
    // Sanitasi: backend /api/register membocorkan hash password di field `data`.
    // Proxy membersihkan sebelum diteruskan ke browser (tanpa ubah backend).
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      if (Array.isArray(json.data)) {
        json.data = (json.data as Record<string, unknown>[]).map(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ({ password: _pw, ...rest }) => rest
        );
      } else if (json.data && typeof json.data === "object") {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _pw2, ...rest } = json.data as Record<string, unknown>;
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
    console.error("[auth/register proxy] fetch failed");
    return NextResponse.json({ status: "error", message: "Gagal menghubungi backend" }, { status: 502 });
  }
}
