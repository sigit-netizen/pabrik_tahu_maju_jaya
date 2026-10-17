import { NextRequest, NextResponse } from "next/server";

export function getSafeOrigin(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const port = process.env.PORT || "3000";
  return `http://127.0.0.1:${port}`;
}

/**
 * Meneruskan request dari route proxy frontend ke backend route internal
 * dengan menyuntikkan x-api-key secara aman di sisi server.
 */
export async function forwardToBackend(
  req: NextRequest,
  backendPath: string,
  method: string = req.method
) {
  const secret = process.env.API_APP_KEY || process.env.API_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { status: "error", message: "Server misconfiguration: API_APP_KEY belum diatur" },
      { status: 500 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  const url = new URL(backendPath, getSafeOrigin());
  req.nextUrl.searchParams.forEach((val, key) => {
    url.searchParams.set(key, val);
  });

  const headers: Record<string, string> = {
    "x-api-key": secret,
    "x-forwarded-for": ip,
  };

  let body: string | undefined = undefined;
  if (method !== "GET" && method !== "HEAD") {
    body = await req.text();
    headers["Content-Type"] = req.headers.get("content-type") || "application/json";
  }

  try {
    const res = await fetch(url.toString(), {
      method,
      headers,
      body,
      cache: "no-store",
    });

    const resText = await res.text();
    try {
      const json = JSON.parse(resText);
      return NextResponse.json(json, { status: res.status });
    } catch {
      return new NextResponse(resText, {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error(`[Proxy ${backendPath}] gagal menghubungi backend:`, err);
    return NextResponse.json(
      { status: "error", message: "Gagal menghubungi backend internal" },
      { status: 502 }
    );
  }
}
