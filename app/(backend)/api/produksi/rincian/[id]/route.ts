import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyDualAuth } from '@/lib/auth-check';
import { formatToWibDate, formatToWibDisplay } from '@/lib/date-helper';

function formatRupiah(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(val || 0);
}

/**
 * @swagger
 * /api/produksi/rincian/{id}:
 *   get:
 *     summary: Mengambil detail satu pesanan pelanggan
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
 *         description: Detail pesanan ditemukan
 *       404:
 *         description: Pesanan tidak ditemukan
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

    const { data, error } = await supabase
      .from('rincian_product_harian')
      .select('*')
      .eq('id', numericId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { status: 'error', message: `Data pesanan #${id} tidak ditemukan.` },
        { status: 404 }
      );
    }

    const sisaVal = data.sisa !== null && data.sisa !== undefined ? Number(data.sisa) : Number(data.total);
    const statusBayar = data.status_pembayaran || (sisaVal === 0 ? 'Lunas' : 'Belum lunas');

    return NextResponse.json({
      status: 'success',
      data: {
        ...data,
        tanggal: formatToWibDate(data.created_at),
        waktu_wib: formatToWibDisplay(data.created_at),
        total: Number(data.total),
        total_rupiah: formatRupiah(Number(data.total) || 0),
        sisa: sisaVal,
        sisa_rupiah: formatRupiah(sisaVal),
        status_pembayaran: statusBayar,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Gagal mengambil detail pesanan', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/produksi/rincian/{id}:
 *   put:
 *     summary: Memperbarui rincian pesanan seorang pelanggan (rincian_product_harian) atau mencatat pembayaran
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
 *               bayar:
 *                 type: integer
 *                 description: Jika diisi, otomatis memotong sisa tagihan dan update status pembayaran
 *               sisa:
 *                 type: integer
 *               status_pembayaran:
 *                 type: string
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
  const { error: authError, user } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const numericId = parseInt(id, 10);
    const body = await request.json();
    const { nama, jumlah_cetak, jumlah_masak, total, bayar, sisa, status_pembayaran } = body;

    // Ambil data lama lebih dulu
    const { data: oldRow, error: fetchErr } = await supabase
      .from('rincian_product_harian')
      .select('*')
      .eq('id', numericId)
      .single();

    if (fetchErr || !oldRow) {
      return NextResponse.json(
        { status: 'error', message: `Data pesanan pelanggan #${id} tidak ditemukan.` },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (nama !== undefined) updates.nama = String(nama).trim();
    if (jumlah_cetak !== undefined) updates.jumlah_cetak = Number(jumlah_cetak);
    if (jumlah_masak !== undefined) updates.jumlah_masak = Number(jumlah_masak);
    if (total !== undefined) updates.total = Number(total);

    // Jika mengirim aksi bayar
    if (bayar !== undefined) {
      const nominalBayar = Number(bayar);
      if (isNaN(nominalBayar) || nominalBayar <= 0) {
        return NextResponse.json(
          { status: 'error', message: 'Nominal pembayaran harus berupa angka lebih dari 0!' },
          { status: 400 }
        );
      }
      const sisaLama = oldRow.sisa !== null && oldRow.sisa !== undefined ? Number(oldRow.sisa) : Number(oldRow.total);
      const hitungSisa = sisaLama - nominalBayar;
      if (hitungSisa <= 0) {
        updates.sisa = 0;
        updates.status_pembayaran = 'Lunas';
      } else {
        updates.sisa = hitungSisa;
        updates.status_pembayaran = 'Belum lunas';
      }
    } else {
      if (sisa !== undefined) updates.sisa = Math.max(0, Number(sisa));
      if (status_pembayaran !== undefined) updates.status_pembayaran = String(status_pembayaran);
    }

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

    const sisaVal = data.sisa !== null && data.sisa !== undefined ? Number(data.sisa) : Number(data.total);
    const statusBayarVal = data.status_pembayaran || (sisaVal === 0 ? 'Lunas' : 'Belum lunas');

    return NextResponse.json({
      status: 'success',
      message: 'Rincian pesanan pelanggan berhasil diperbarui!',
      data: {
        ...data,
        tanggal: formatToWibDate(data.created_at),
        waktu_wib: formatToWibDisplay(data.created_at),
        total: Number(data.total),
        total_rupiah: formatRupiah(Number(data.total) || 0),
        sisa: sisaVal,
        sisa_rupiah: formatRupiah(sisaVal),
        status_pembayaran: statusBayarVal,
        audit: {
          diupdate_oleh: user?.username || 'admin',
        },
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
