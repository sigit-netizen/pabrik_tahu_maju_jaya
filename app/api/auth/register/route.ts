import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { supabase } from "@/lib/supabase";
import bcrypt from "bcryptjs";

// Endpoint Autentikasi Register Server-Side (Langsung ke Supabase tanpa loopback HTTP fetch)
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;

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

  const username = typeof body.username === "string" ? body.username.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !email || !password) {
    return NextResponse.json(
      { status: "error", message: "Username, email, dan password wajib diisi!" },
      { status: 400 }
    );
  }

  if (password.length < 4) {
    return NextResponse.json(
      { status: "error", message: "Password harus terdiri dari minimal 4 karakter!" },
      { status: 400 }
    );
  }

  try {
    // 1. Cek apakah email sudah terdaftar
    const { data: existingUsers } = await supabase
      .from("admin")
      .select("id")
      .eq("email", email);

    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json(
        { status: "error", message: "Email sudah terdaftar. Silakan gunakan email lain!" },
        { status: 400 }
      );
    }

    // 2. Hash password dengan bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 3. Masukkan ke tabel admin dengan status 2 (pending approval)
    const { data, error } = await supabase
      .from("admin")
      .insert([
        {
          username,
          email,
          password: hashedPassword,
          status: 2,
        },
      ])
      .select("id, username, email, status");

    if (error) {
      return NextResponse.json(
        { status: "error", message: "Gagal menyimpan data pendaftaran ke database", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        status: "success",
        message: "Registrasi berhasil! Akun Anda sedang menunggu persetujuan Administrator.",
        data,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[auth/register] error:", err);
    return NextResponse.json(
      { status: "error", message: "Terjadi kesalahan internal server saat memproses registrasi" },
      { status: 500 }
    );
  }
}
