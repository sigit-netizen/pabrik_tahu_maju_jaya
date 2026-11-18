import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyDualAuth } from '@/lib/auth-check';

/**
 * @swagger
 * /api/pengaturan/harga/{id}:
 *   put:
 *     summary: Mengoreksi / Mengedit nominal harga cetak pada baris ID tertentu (Menu Pengaturan)
 *     tags:
 *       - Pengaturan
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID baris pada tabel harga_cetak
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - harga
 *             properties:
 *               harga:
 *                 type: integer
 *                 example: 2200
 *     responses:
 *       200:
 *         description: Harga cetak berhasil dikoreksi
 *       400:
 *         description: Input tidak valid
 *       401:
 *         description: Akses ditolak
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
    const { harga } = body;
    const nominal = Number(harga);

    if (isNaN(nominal) || nominal <= 0) {
      return NextResponse.json(
        { status: 'error', message: 'Nominal harga harus berupa angka lebih dari 0!' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('harga_cetak')
      .update({ harga: nominal })
      .eq('id', numericId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { status: 'error', message: 'Gagal mengubah harga cetak', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: 'success',
      message: `Harga cetak ID #${id} berhasil diubah menjadi Rp ${nominal.toLocaleString('id-ID')}`,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Terjadi kesalahan sistem saat mengubah harga', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/pengaturan/harga/{id}:
 *   delete:
 *     summary: Menghapus catatan riwayat harga cetak (Menu Pengaturan)
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
 *         description: Catatan harga cetak berhasil dihapus
 *       401:
 *         description: Akses ditolak
 */
export async function DELETE(
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

    const { error } = await supabase
      .from('harga_cetak')
      .delete()
      .eq('id', numericId);

    if (error) {
      return NextResponse.json(
        { status: 'error', message: 'Gagal menghapus catatan harga cetak', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: 'success',
      message: `Catatan harga cetak ID #${id} berhasil dihapus.`,
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Terjadi kesalahan sistem saat menghapus harga', details: String(error) },
      { status: 500 }
    );
  }
}
