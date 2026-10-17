import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyDualAuth } from '@/lib/auth-check';

/**
 * @swagger
 * /api/produksi/rincian/{id}:
 *   put:
 *     summary: Memperbarui rincian pesanan seorang pelanggan (rincian_product_harian)
 *     tags:
 *       - Produksi
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID baris rincian pelanggan
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nama:
 *                 type: string
 *               jumlah_cetak:
 *                 type: integer
 *               jumlah_masak:
 *                 type: integer
 *               total:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Data pesanan pelanggan berhasil diubah
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
    const body = await request.json();
    const { nama, jumlah_cetak, jumlah_masak, total } = body;

    const updates: Record<string, unknown> = {};
    if (nama !== undefined) updates.nama = String(nama).trim();
    if (jumlah_cetak !== undefined) updates.jumlah_cetak = Number(jumlah_cetak);
    if (jumlah_masak !== undefined) updates.jumlah_masak = Number(jumlah_masak);
    if (total !== undefined) updates.total = Number(total);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { status: 'error', message: 'Tidak ada data yang dikirim untuk diperbarui.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('rincian_product_harian')
      .update(updates)
      .eq('id', numericId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { status: 'error', message: 'Gagal memperbarui rincian pesanan pelanggan', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: 'success',
      message: 'Rincian pesanan pelanggan berhasil diperbarui!',
      data: {
        ...data,
        total_rupiah: new Intl.NumberFormat('id-ID', {
          style: 'currency',
          currency: 'IDR',
          minimumFractionDigits: 0,
        }).format(Number(data.total) || 0),
      },
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
 * /api/produksi/rincian/{id}:
 *   delete:
 *     summary: Menghapus rincian pesanan seorang pelanggan
 *     tags:
 *       - Produksi
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Rincian pesanan pelanggan berhasil dihapus
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

    const { error } = await supabase
      .from('rincian_product_harian')
      .delete()
      .eq('id', numericId);

    if (error) {
      return NextResponse.json(
        { status: 'error', message: 'Gagal menghapus rincian pelanggan', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: 'success',
      message: `Pesanan pelanggan #${id} berhasil dihapus.`,
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Terjadi kesalahan sistem saat menghapus data', details: String(error) },
      { status: 500 }
    );
  }
}
