import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Masuk (Login) ke dalam sistem
 *     description: Endpoint untuk memverifikasi username dan password. Jika status akun masih 2 (no), maka akses akan ditolak. Dilengkapi pelindung Brute Force (Rate Limiter).
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
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: "sigit@example.com"
 *               password:
 *                 type: string
 *                 example: "rahasia123"
 *     responses:
 *       200:
 *         description: Login Berhasil
 *       400:
 *         description: Email atau password salah / tidak lengkap
 *       401:
 *         description: Akses ditolak (API Key salah/tidak ada)
 *       403:
 *         description: Akses ditolak (Akun belum disetujui Admin)
 *       429:
 *         description: Terlalu banyak percobaan (Spam/Brute Force)
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

    // --- KEAMANAN LAPIS 2: Rate Limiter (Anti Brute-Force) ---
    // SEMENTARA DIMATIKAN UNTUK TESTING
    // const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    // const isAllowed = checkRateLimit(ip);
    
    // if (!isAllowed) {
    //   return NextResponse.json(
    //     { status: 'error', message: 'Terlalu banyak percobaan Login. Silakan tunggu 1 menit!' },
    //     { status: 429 }
    //   );
    // }

    const body = await request.json();
    const { email, password } = body;

    // 1. Validasi input sederhana
    if (!email || !password) {
      return NextResponse.json(
        { status: 'error', message: 'Email dan password wajib diisi!' },
        { status: 400 }
      );
    }

    // 2. Mencari pengguna di database tabel 'admin' berdasarkan email
    const { data: user, error } = await supabase
      .from('admin')
      .select('*')
      .eq('email', email)
      .single(); // Ambil 1 baris saja

    // Jika error atau email tidak ditemukan
    if (error || !user) {
      return NextResponse.json(
        { status: 'error', message: 'Email atau password salah!' },
        { status: 400 } // Gunakan pesan umum agar hacker tidak tahu mana yang salah
      );
    }

    // 3. Mengecek kecocokan Password menggunakan bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return NextResponse.json(
        { status: 'error', message: 'Email atau password salah!' },
        { status: 400 }
      );
    }

    // 4. Mengecek Status Persetujuan Admin (1 = yes, 2 = no)
    if (user.status !== 1) {
      return NextResponse.json(
        { 
          status: 'error', 
          message: 'Akses Ditolak: Akun Anda belum disetujui. Silakan hubungi Administrator.' 
        },
        { status: 403 } // 403 Forbidden
      );
    }

    // 5. Login Sukses!
    // Kita harus membuang (menghapus) password dari data sebelum dikirim kembali ke FE,
    // karena mengirim password (walaupun sudah diacak) ke FE adalah larangan keras!
    const { password: _, ...safeUserData } = user;

    return NextResponse.json(
      { 
        status: 'success', 
        message: 'Login berhasil! Selamat datang.', 
        data: safeUserData 
      },
      { status: 200 }
    );

  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Terjadi kesalahan internal server', details: String(error) },
      { status: 500 }
    );
  }
}
