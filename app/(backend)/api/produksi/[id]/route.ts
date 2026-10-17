import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyDualAuth } from '@/lib/auth-check';
import { formatToWibDate, formatToWibDisplay, getWibDayRange } from '@/lib/date-helper';

/**
 * @swagger
 * /api/produksi/{id}:
 *   get:
 *     summary: Mengambil detail satu data produksi harian beserta rincian tagihan tiap pelanggan
 *     description: |
 *       Mengembalikan rekap header dari product_harian dan rincian pesanan dari
 *       rincian_product_harian pada tanggal tersebut, sehingga admin mengetahui
 *       berapa tagihan (total bayar) dari masing-masing pelanggan.
 *     tags:
 *       - Produksi
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID baris rekap pada tabel product_harian
 *     responses:
 *       200:
 *         description: Detail produksi dan tagihan per pelanggan berhasil dimuat
 *       404:
 *         description: Data produksi tidak ditemukan
 *       401:
 *         description: Belum login atau API Key tidak valid
 *       500:
 *         description: Kesalahan server
 */
export async function GET(
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

    // 1. Ambil data header dari product_harian
    const { data: header, error: headerError } = await supabase
      .from('product_harian')
      .select('*')
      .eq('id', numericId)
      .single();

    if (headerError || !header) {
      return NextResponse.json(
        { status: 'error', message: `Data produksi harian dengan ID ${id} tidak ditemukan.` },
        { status: 404 }
      );
    }

    // 2. Tentukan rentang tanggal penuh hari tersebut dalam WIB (00:00:00 - 23:59:59 WIB)
    const dateStr = formatToWibDate(header.created_at);
    const { startWib, endWib } = getWibDayRange(dateStr);

    // 3. Ambil rincian pesanan tiap pelanggan pada hari yang sama dari rincian_product_harian
    const { data: rincianList, error: rincianError } = await supabase
      .from('rincian_product_harian')
      .select('*')
      .gte('created_at', startWib)
      .lte('created_at', endWib)
      .order('created_at', { ascending: true });

    if (rincianError) {
      console.warn('[produksi/[id]] Gagal memuat rincian pelanggan:', rincianError.message);
    }

    // 4. Format data pelanggan dengan nominal Rupiah dan waktu WIB
    const formatRupiah = (val: number) =>
      new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(val || 0);

    const daftarPelanggan = (rincianList || []).map((item) => ({
      id: item.id,
      nama: item.nama,
      jumlah_cetak: Number(item.jumlah_cetak) || 0,
      jumlah_masak: Number(item.jumlah_masak) || 0,
      total_bayar: Number(item.total) || 0,
      total_bayar_rupiah: formatRupiah(Number(item.total) || 0),
      tanggal: formatToWibDate(item.created_at),
      waktu_pesan: formatToWibDisplay(item.created_at),
    }));

    return NextResponse.json({
      status: 'success',
      data: {
        rekap_harian: {
          id: header.id,
          tanggal: dateStr,
          waktu_input: formatToWibDisplay(header.created_at),
          total_cetak: Number(header.jumlah_cetak) || 0,
          total_masak: Number(header.jumlah_masak) || 0,
          total_pendapatan: Number(header.jumlah_pendapatan) || 0,
          total_pendapatan_rupiah: formatRupiah(Number(header.jumlah_pendapatan) || 0),
        },
        ringkasan_pelanggan: {
          jumlah_pelanggan: daftarPelanggan.length,
          pelanggan: daftarPelanggan,
        },
        audit: {
          tanggal_wib: dateStr,
          waktu_input_wib: formatToWibDisplay(header.created_at),
          zona_waktu: 'Asia/Jakarta (WIB - UTC+7)',
          diakses_oleh: user?.username || 'admin',
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Gagal mengambil detail produksi', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/produksi/{id}:
 *   put:
 *     summary: Memperbarui data rekap harian produksi (product_harian)
 *     tags:
 *       - Produksi
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
 *               jumlah_cetak:
 *                 type: integer
 *               jumlah_masak:
 *                 type: integer
 *               jumlah_pendapatan:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Data rekap harian berhasil diperbarui
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
    const body = await request.json();
    const { jumlah_cetak, jumlah_masak, jumlah_pendapatan } = body;

    const updates: Record<string, unknown> = {};
    if (jumlah_cetak !== undefined) updates.jumlah_cetak = Number(jumlah_cetak);
    if (jumlah_masak !== undefined) updates.jumlah_masak = Number(jumlah_masak);
    if (jumlah_pendapatan !== undefined) updates.jumlah_pendapatan = Number(jumlah_pendapatan);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { status: 'error', message: 'Tidak ada data yang dikirim untuk diperbarui.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('product_harian')
      .update(updates)
      .eq('id', numericId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { status: 'error', message: 'Gagal memperbarui data rekap produksi', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: 'success',
      message: `Data rekap produksi #${id} berhasil diperbarui!`,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Terjadi kesalahan saat update data', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/produksi/{id}:
 *   delete:
 *     summary: Menghapus catatan rekap produksi harian
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
 *         description: Catatan rekap harian berhasil dihapus
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
      .from('product_harian')
      .delete()
      .eq('id', numericId);

    if (error) {
      return NextResponse.json(
        { status: 'error', message: 'Gagal menghapus rekap produksi', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: 'success',
      message: `Catatan rekap produksi harian #${id} berhasil dihapus.`,
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'error', message: 'Terjadi kesalahan saat menghapus data', details: String(error) },
      { status: 500 }
    );
  }
}
