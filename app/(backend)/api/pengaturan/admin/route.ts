import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyDualAuth } from '@/lib/auth-check';
import bcrypt from 'bcryptjs';

/**
 * @swagger
 * /api/pengaturan/admin:
 *   get:
 *     summary: Mengambil daftar seluruh akun admin pabrik (Menu Pengaturan > Kelola Admin)
 *     tags:
 *       - Pengaturan
 *     responses:
 *       200:
 *         description: Berhasil memuat daftar admin
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: array
 *       401:
 *         description: Belum login atau API Key tidak valid
 *       500:
 *         description: Terjadi kesalahan server
 */
export async function GET(request: Request) {
  const { error: authError } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const { data, error } = await supabase
      .from('admin')
      .select('id, username, email, status, created_at')
      .order('id', { ascending: true });

    if (error) {
      return NextResponse.json(
        { status: 'error', message: 'Gagal mengambil data admin', details: error.message },
        { status: 500 }
      );
    }

    const formatted = (data || []).map((adm) => ({
      ...adm,
      status_label: adm.status === 1 ? 'Aktif' : 'Nonaktif',
    }));

    return NextResponse.json({
      status: 'success',
      data: formatted,
      total: formatted.length,
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Terjadi kesalahan sistem', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/pengaturan/admin:
 *   post:
 *     summary: Menambahkan akun admin baru (Menu Pengaturan > Kelola Admin)
 *     description: |
 *       Mendaftarkan rekan admin atau staf baru ke dalam sistem. Password akan otomatis
 *       di-hash secara aman menggunakan bcrypt sebelum disimpan ke database.
 *     tags:
 *       - Pengaturan
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
 *                 example: "admin_budi"
 *               email:
 *                 type: string
 *                 example: "budi@pabriktahu.com"
 *               password:
 *                 type: string
 *                 example: "pabrik123"
 *               status:
 *                 type: integer
 *                 description: "1 = Aktif, 0 = Nonaktif"
 *                 example: 1
 *     responses:
 *       201:
 *         description: Akun admin baru berhasil dibuat
 *       400:
 *         description: Validasi gagal atau username/email sudah terdaftar
 *       401:
 *         description: Akses ditolak
 */
export async function POST(request: Request) {
  const { error: authError } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { username, email, password, status } = body;

    // Validasi field wajib
    if (!username || !email || !password) {
      return NextResponse.json(
        { status: 'error', message: 'Field username, email, dan password wajib diisi!' },
        { status: 400 }
      );
    }

    const cleanUsername = String(username).trim();
    const cleanEmail = String(email).trim().toLowerCase();

    // Validasi format email
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(cleanEmail)) {
      return NextResponse.json(
        { status: 'error', message: 'Format email tidak valid!' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { status: 'error', message: 'Password minimal 6 karakter!' },
        { status: 400 }
      );
    }

    // Cek apakah username atau email sudah pernah dipakai
    const { data: existingUser } = await supabase
      .from('admin')
      .select('id, username, email')
      .or(`username.eq.${cleanUsername},email.eq.${cleanEmail}`)
      .limit(1)
      .maybeSingle();

    if (existingUser) {
      const isUsernameDuplicate = existingUser.username.toLowerCase() === cleanUsername.toLowerCase();
      return NextResponse.json(
        {
          status: 'error',
          message: isUsernameDuplicate
            ? 'Username ini sudah digunakan admin lain!'
            : 'Email ini sudah terdaftar!',
        },
        { status: 400 }
      );
    }

    // Hash password dengan bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);
    const userStatus = status !== undefined ? Number(status) : 1;

    // Simpan ke database Supabase
    const { data: newAdmin, error: insertError } = await supabase
      .from('admin')
      .insert([
        {
          username: cleanUsername,
          email: cleanEmail,
          password: hashedPassword,
          status: userStatus,
        },
      ])
      .select('id, username, email, status, created_at')
      .single();

    if (insertError) {
      return NextResponse.json(
        { status: 'error', message: 'Gagal membuat admin baru', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        status: 'success',
        message: `Admin "${cleanUsername}" berhasil ditambahkan!`,
        data: newAdmin,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Terjadi kesalahan sistem saat membuat admin', details: String(error) },
      { status: 500 }
    );
  }
}
