import { NextRequest, NextResponse } from "next/server";

// Route ini adalah PROXY yang berjalan di SERVER.
// Browser memanggil /api/auth/login TANPA header x-api-key.
// Server di sini yang menyuntikkan API_SECRET_KEY ke /api/login,
// sehingga secret TIDAK PERNAH masuk ke bundle JS / terlihat di DevTools.
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
    const target = `${origin}/api/login`;

    // Teruskan IP asli agar rate-limit backend tetap bekerja bila diaktifkan
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
    // Kembalikan apa adanya dari backend (status + body JSON)
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
