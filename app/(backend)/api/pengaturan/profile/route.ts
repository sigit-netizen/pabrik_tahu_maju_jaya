import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyDualAuth } from '@/lib/auth-check';

/**
 * @swagger
 * /api/pengaturan/profile:
 *   get:
 *     summary: Mengambil data profil admin yang sedang login
 *     tags:
 *       - Pengaturan
 *     parameters:
 *       - in: query
 *         name: id
 *         required: false
 *         schema:
 *           type: integer
 *         description: ID admin (opsional, otomatis diambil dari sesi cookie jika login)
 *     responses:
 *       200:
 *         description: Data profil berhasil diambil
 *       404:
 *         description: Admin tidak ditemukan
 *   put:
 *     summary: Memperbarui profil admin (username, email)
 *     tags:
 *       - Pengaturan
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *                 example: 2
 *               username:
 *                 type: string
 *                 example: "sigit_admin"
 *               email:
 *                 type: string
 *                 example: "sigit@example.com"
 *     responses:
 *       200:
 *         description: Profil berhasil diperbarui
 *       400:
 *         description: Input tidak valid atau email/username sudah dipakai
 */

// 1. GET: Ambil Profil Admin
export async function GET(request: Request) {
  const { error: authError, user } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || user?.id;

    if (!id) {
      return NextResponse.json(
        { status: 'error', message: 'Parameter query ?id= atau sesi login wajib ada!' },
        { status: 400 }
      );
    }

    const { data: adminData, error } = await supabase
      .from('admin')
      .select('id, username, email, status, created_at')
      .eq('id', id)
      .single();

    if (error || !adminData) {
      return NextResponse.json(
        { status: 'error', message: 'Data admin tidak ditemukan.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: 'success',
      data: adminData,
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Gagal memuat profil', details: String(error) },
      { status: 500 }
    );
  }
}

// 2. PUT: Update Profil Admin
export async function PUT(request: Request) {
  const { error: authError, user } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { id, username, email } = body;
    const targetId = id || user?.id;

    if (!targetId) {
      return NextResponse.json(
        { status: 'error', message: 'Field id atau sesi login wajib ada!' },
        { status: 400 }
      );
    }

    const updates: Record<string, string> = {};
    if (username) updates.username = username.trim();
    if (email) {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
      if (!emailOk) {
        return NextResponse.json({ status: 'error', message: 'Format email tidak valid!' }, { status: 400 });
      }
      updates.email = email.trim();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { status: 'error', message: 'Tidak ada data profil yang diubah.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('admin')
      .update(updates)
      .eq('id', targetId)
      .select('id, username, email, status, created_at')
      .single();

    if (error) {
      return NextResponse.json(
        { status: 'error', message: 'Gagal memperbarui profil di database', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: 'success',
      message: 'Profil admin berhasil diperbarui!',
      data,
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Terjadi kesalahan saat update profil', details: String(error) },
      { status: 500 }
    );
  }
}
