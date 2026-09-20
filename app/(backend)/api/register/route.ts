import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * @swagger
 * /api/register:
 *   post:
 *     summary: Mendaftarkan pengguna baru
 *     description: Endpoint untuk mendaftarkan pengguna baru ke dalam database Supabase. Dilengkapi pelindung API Key dan Rate Limiter (Max 3 request/menit).
 *     parameters:
 *       - in: header
 *         name: x-api-key
 *         required: true
 *         schema:
 *           type: string
 *         description: Kunci rahasia API (Masukkan nilai rahasia-capstone-123)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: "sigitnetizen"
 *               email:
 *                 type: string
 *                 example: "sigit@example.com"
 *               password:
 *                 type: string
 *                 example: "rahasia123"
 *     responses:
 *       201:
 *         description: Berhasil mendaftar
 *       400:
 *         description: Gagal mendaftar (Data tidak lengkap atau error database)
 *       401:
 *         description: Akses ditolak (API Key salah/tidak ada)
 *       429:
 *         description: Terlalu banyak percobaan (Terkena Rate Limit)
 *       500:
 *         description: Terjadi kesalahan pada server
 */
export async function POST(request: Request) {
  try {
    // --- KEAMANAN LAPIS 1: Cek Internal API Key ---
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.API_SECRET_KEY) {
      return NextResponse.json(
        { status: 'error', message: 'Akses Ditolak: API Key tidak valid atau tidak ditemukan!' },
        { status: 401 }
      );
    }

    // --- KEAMANAN LAPIS 2: Rate Limiter (Anti-Spam) ---
    // Mengambil alamat IP (Biasanya di header x-forwarded-for, fallback ke localhost)
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const isAllowed = checkRateLimit(ip);
    
    if (!isAllowed) {
      return NextResponse.json(
        { status: 'error', message: 'Terlalu banyak request (Spam terdeteksi). Silakan tunggu 1 menit!' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { username, email, password } = body;

    // 1. Validasi input sederhana
    if (!username || !email || !password) {
      return NextResponse.json(
        { status: 'error', message: 'Username, email, dan password wajib diisi!' },
        { status: 400 }
      );
    }

    // Validasi panjang password minimal 4 karakter
    if (password.length < 4) {
      return NextResponse.json(
        { status: 'error', message: 'Password harus terdiri dari minimal 4 karakter!' },
        { status: 400 }
      );
    }

    // 2. Mengecek apakah email sudah terdaftar
    const { data: existingUsers } = await supabase
      .from('admin')
      .select('id')
      .eq('email', email);

    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json(
        { status: 'error', message: 'Email sudah terdaftar. Silakan gunakan email lain!' },
        { status: 400 }
      );
    }

    // 3. Hash password menggunakan bcryptjs agar aman
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 3. Menyimpan ke database Supabase (Tabel 'admin')
    const { data, error } = await supabase
      .from('admin')
      .insert([
        {
          username: username,
          email: email,
          password: hashedPassword, // Menyimpan password yang sudah diacak
          status: 2, // 2 = 'no' (Belum diverifikasi)
        },
      ])
      .select();

    if (error) {
      return NextResponse.json(
        { status: 'error', message: 'Gagal mendaftar ke database', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { status: 'success', message: 'Registrasi berhasil!', data: data },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Terjadi kesalahan internal server', details: String(error) },
      { status: 500 }
    );
  }
}
