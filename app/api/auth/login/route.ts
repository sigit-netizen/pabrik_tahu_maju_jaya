import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { setSessionCookie, SessionUser } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import bcrypt from "bcryptjs";

// Endpoint Autentikasi Login Server-Side (Langsung ke Supabase tanpa loopback HTTP fetch)
// Menjamin tidak terblokir oleh Vercel Deployment Protection & 10x lebih cepat
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;

export async function POST(req: NextRequest) {
  // Rate-limit per IP (5 req/menit)
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

  let body: Record<string, unknown>;
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

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { status: "error", message: "Email dan password wajib diisi!" },
      { status: 400 }
    );
  }

  try {
    // 1. Cari user di database tabel 'admin'
    const { data: user, error } = await supabase
      .from("admin")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { status: "error", message: "Email atau password salah!" },
        { status: 400 }
      );
    }

    // 2. Verifikasi password dengan bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { status: "error", message: "Email atau password salah!" },
        { status: 400 }
      );
    }

    // 3. Verifikasi status admin (1 = aktif / disetujui, 2 = pending approval)
    if (user.status !== 1) {
      return NextResponse.json(
        {
          status: "error",
          message: "Akses Ditolak: Akun Anda belum disetujui. Silakan hubungi Administrator.",
        },
        { status: 403 }
      );
    }

    // 4. Siapkan data tanpa password
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pw, ...safeUserData } = user;

    const response = NextResponse.json(
      {
        status: "success",
        message: "Login berhasil! Selamat datang.",
        data: safeUserData,
      },
      { status: 200 }
    );

    // 5. Tanam session cookie httpOnly
    setSessionCookie(response, safeUserData as SessionUser);

    return response;
  } catch (err) {
    console.error("[auth/login] database/server error:", err);
    return NextResponse.json(
      { status: "error", message: "Terjadi kesalahan internal server saat memproses login" },
      { status: 500 }
    );
  }
}
