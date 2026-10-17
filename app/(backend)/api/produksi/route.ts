import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyDualAuth } from '@/lib/auth-check';
import { formatToWibDate, formatToWibDisplay } from '@/lib/date-helper';

/**
 * @swagger
 * /api/produksi:
 *   get:
 *     summary: Mengambil daftar riwayat catatan produksi harian (Menu Riwayat Produksi)
 *     description: |
 *       Menampilkan rekap produksi harian dari tabel product_harian.
 *       Mendukung paginasi, filter rentang tanggal (start_date & end_date),
 *       serta menyertakan format Rupiah untuk jumlah_pendapatan.
 *     tags:
 *       - Produksi
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Nomor halaman
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Jumlah data per halaman
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter tanggal awal (YYYY-MM-DD)
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter tanggal akhir (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Daftar riwayat produksi harian berhasil diambil
 *       401:
 *         description: Belum login atau API Key tidak valid
 *       500:
 *         description: Terjadi kesalahan server
 */
export async function GET(request: Request) {
  // ── KEAMANAN GANDA: sesi login httpOnly + API key sesudah login ─────────────
  const { error: authError } = verifyDualAuth(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10', 10)));
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('product_harian')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Filter tanggal berdasarkan created_at dengan offset zona WIB (UTC+7)
    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00+07:00`);
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59.999+07:00`);
    }

    const { data, count, error } = await query.range(from, to);

    if (error) {
      return NextResponse.json(
        { status: 'error', message: 'Gagal membaca riwayat produksi dari database', details: error.message },
        { status: 500 }
      );
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    // Format data dengan tambahan field tanggal WIB dan format Rupiah
    const formattedData = (data || []).map((row) => ({
      id: row.id,
      created_at: row.created_at,
      tanggal: formatToWibDate(row.created_at),
      waktu_wib: formatToWibDisplay(row.created_at),
      jumlah_cetak: Number(row.jumlah_cetak) || 0,
      jumlah_masak: Number(row.jumlah_masak) || 0,
      jumlah_pendapatan: Number(row.jumlah_pendapatan) || 0,
      jumlah_pendapatan_rupiah: new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(Number(row.jumlah_pendapatan) || 0),
    }));

    return NextResponse.json({
      status: 'success',
      message: 'Riwayat data produksi berhasil dimuat',
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
      data: formattedData,
    });
  } catch (error) {
    console.error('[API Produksi GET Error]:', error);
    return NextResponse.json(
      { status: 'error', message: 'Gagal mengambil riwayat produksi', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * @swagger
 * /api/produksi:
 *   post:
 *     summary: Alias untuk input produksi harian (mengarah ke /api/produksi/input)
 *     tags:
 *       - Produksi
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rincian
 *             properties:
 *               rincian:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     nama:
 *                       type: string
 *                     jumlah_cetak:
 *                       type: integer
 *                     jumlah_masak:
 *                       type: integer
 *                     total:
 *                       type: integer
 *     responses:
 *       201:
 *         description: Data produksi berhasil disimpan
 *       400:
 *         description: Data tidak lengkap
 */
export async function POST(request: Request) {
  // Meneruskan langsung ke logika input produksi
  const { POST: handleInput } = await import('./input/route');
  return handleInput(request);
}
