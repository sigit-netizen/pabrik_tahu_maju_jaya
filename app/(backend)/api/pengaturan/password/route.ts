import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import { verifyDualAuth } from '@/lib/auth-check';

/**
 * @swagger
 * /api/pengaturan/password:
 *   put:
 *     summary: Mengubah password akun admin (Menu Pengaturan)
 *     tags:
 *       - Pengaturan
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password_lama
 *               - password_baru
 *             properties:
 *               id:
 *                 type: integer
 *                 example: 2
 *               password_lama:
 *                 type: string
 *                 example: "rahasia123"
 *               password_baru:
 *                 type: string
 *                 example: "passwordBaruSuperAman2026!"
 *     responses:
 *       200:
 *         description: Password berhasil diubah
 *       400:
 *         description: Password lama salah atau validasi gagal
 *       500:
 *         description: Kesalahan server
 */
export async function PUT(request: Request) {
  const { error: authError, user } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { id, password_lama, password_baru } = body;
    const targetId = id || user?.id;

    if (!targetId || !password_lama || !password_baru) {
      return NextResponse.json(
        { status: 'error', message: 'Field target id (atau login aktif), password_lama, dan password_baru wajib diisi!' },
        { status: 400 }
      );
    }

    if (password_baru.length < 6) {
      return NextResponse.json(
        { status: 'error', message: 'Password baru minimal harus 6 karakter!' },
        { status: 400 }
      );
    }

    // 1. Ambil hash password admin saat ini
    const { data: adminRecord, error } = await supabase
      .from('admin')
      .select('id, password')
      .eq('id', targetId)
      .single();

    if (error || !adminRecord) {
      return NextResponse.json(
        { status: 'error', message: 'Admin tidak ditemukan.' },
        { status: 404 }
      );
    }

    // 2. Verifikasi apakah password lama cocok
    const isOldPasswordValid = await bcrypt.compare(password_lama, adminRecord.password);
    if (!isOldPasswordValid) {
      return NextResponse.json(
        { status: 'error', message: 'Password lama yang Anda masukkan salah!' },
        { status: 400 }
      );
    }

    // 3. Hash password baru dengan bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(password_baru, salt);

    // 4. Update ke database
    const { error: updateError } = await supabase
      .from('admin')
      .update({ password: hashedNewPassword })
      .eq('id', targetId);

    if (updateError) {
      return NextResponse.json(
        { status: 'error', message: 'Gagal memperbarui password di database', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'success',
      message: 'Password akun Anda berhasil diperbarui!',
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Terjadi kesalahan saat mengganti password', details: String(error) },
      { status: 500 }
    );
  }
}
