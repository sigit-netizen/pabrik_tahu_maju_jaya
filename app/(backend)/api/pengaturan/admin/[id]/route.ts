import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyDualAuth } from '@/lib/auth-check';
import bcrypt from 'bcryptjs';

/**
 * @swagger
 * /api/pengaturan/admin/{id}:
 *   get:
 *     summary: Mengambil detail satu akun admin (Menu Pengaturan > Kelola Admin)
 *     tags:
 *       - Pengaturan
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detail admin ditemukan
 *       404:
 *         description: Admin tidak ditemukan
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const numericId = parseInt(id, 10);

    if (isNaN(numericId)) {
      return NextResponse.json(
        { status: 'error', message: 'Parameter ID harus berupa angka!' },
        { status: 400 }
      );
    }

    const { data: adminData, error } = await supabase
      .from('admin')
      .select('id, username, email, status, created_at')
      .eq('id', numericId)
      .single();

    if (error || !adminData) {
      return NextResponse.json(
        { status: 'error', message: `Admin dengan ID #${id} tidak ditemukan.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: 'success',
      data: {
        ...adminData,
        status_label: adminData.status === 1 ? 'Aktif' : 'Nonaktif',
      },
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
 * /api/pengaturan/admin/{id}:
 *   put:
 *     summary: Mengubah profil/status/password admin tertentu (Menu Pengaturan > Kelola Admin)
 *     tags:
 *       - Pengaturan
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               status:
 *                 type: integer
 *                 description: "1 = Aktif, 0 = Nonaktif"
 *               password_baru:
 *                 type: string
 *                 description: "Opsional jika ingin mereset password admin ini"
 *     responses:
 *       200:
 *         description: Akun admin berhasil diperbarui
 *       400:
 *         description: Input tidak valid
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const numericId = parseInt(id, 10);

    if (isNaN(numericId)) {
      return NextResponse.json(
        { status: 'error', message: 'Parameter ID harus berupa angka!' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { username, email, status, password_baru } = body;

    const updates: Record<string, unknown> = {};

    if (username) updates.username = String(username).trim();
    if (email) {
      const cleanEmail = String(email).trim().toLowerCase();
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(cleanEmail)) {
        return NextResponse.json(
          { status: 'error', message: 'Format email tidak valid!' },
          { status: 400 }
        );
      }
      updates.email = cleanEmail;
    }
    if (status !== undefined) {
      updates.status = Number(status);
    }
    if (password_baru) {
      if (password_baru.length < 6) {
        return NextResponse.json(
          { status: 'error', message: 'Password baru minimal 6 karakter!' },
          { status: 400 }
        );
      }
      updates.password = await bcrypt.hash(password_baru, 10);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { status: 'error', message: 'Tidak ada field yang dikirim untuk diperbarui.' },
        { status: 400 }
      );
    }

    const { data: updatedAdmin, error } = await supabase
      .from('admin')
      .update(updates)
      .eq('id', numericId)
      .select('id, username, email, status, created_at')
      .single();

    if (error) {
      return NextResponse.json(
        { status: 'error', message: 'Gagal memperbarui data admin', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: 'success',
      message: `Data admin #${id} berhasil diperbarui!`,
      data: updatedAdmin,
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Terjadi kesalahan sistem saat memperbarui data', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/pengaturan/admin/{id}:
 *   delete:
 *     summary: Menghapus akun admin (Menu Pengaturan > Kelola Admin)
 *     description: |
 *       Menghapus akun staf/admin dari sistem. Sistem memblokir penghapusan
 *       jika admin mencoba menghapus akunnya sendiri yang sedang aktif login.
 *     tags:
 *       - Pengaturan
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Akun admin berhasil dihapus
 *       400:
 *         description: Tidak diperbolehkan menghapus akun sendiri
 *       404:
 *         description: Admin tidak ditemukan
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError, user } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const numericId = parseInt(id, 10);

    if (isNaN(numericId)) {
      return NextResponse.json(
        { status: 'error', message: 'Parameter ID harus berupa angka!' },
        { status: 400 }
      );
    }

    // Proteksi: Tidak boleh menghapus akun yang sedang dipakai login saat ini
    if (user && user.id === numericId) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Tindakan ditolak: Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan!',
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('admin')
      .delete()
      .eq('id', numericId);

    if (error) {
      return NextResponse.json(
        { status: 'error', message: 'Gagal menghapus admin', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: 'success',
      message: `Akun admin ID #${id} berhasil dihapus dari sistem.`,
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Terjadi kesalahan sistem saat menghapus admin', details: String(error) },
      { status: 500 }
    );
  }
}
