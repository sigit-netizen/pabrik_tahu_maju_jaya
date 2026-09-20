import { NextRequest, NextResponse } from "next/server";

// PROXY server-side untuk register: browser -> /api/auth/register -> server
// menyuntikkan API_SECRET_KEY -> /api/register. Secret tetap di server.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.API_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { status: "error", message: "Server misconfiguration: API_SECRET_KEY hilang" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: "error", message: "Body JSON tidak valid" },
      { status: 400 }
    );
  }

  try {
    const origin = req.nextUrl.origin;
    const target = `${origin}/api/register`;

    const forwardedFor =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-api-key": secret,
    };
    if (forwardedFor) headers["x-forwarded-for"] = forwardedFor;

    const res = await fetch(target, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return NextResponse.json(
      { status: "error", message: "Gagal menghubungi backend", details: String(e) },
      { status: 500 }
    );
  }
}
