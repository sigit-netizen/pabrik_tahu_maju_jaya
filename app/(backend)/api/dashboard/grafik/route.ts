import { NextResponse } from 'next/server';
import { verifyDualAuth } from '@/lib/auth-check';
import { getDashboardMetrics } from '@/lib/dashboard-service';

/**
 * @swagger
 * /api/dashboard/grafik:
 *   get:
 *     summary: Mendapatkan data deret waktu grafik analitik produksi (harian, mingguan, bulanan)
 *     description: |
 *       Menghasilkan data grafik analitik berdasarkan rentang tanggal kalender sistem:
 *       - Mode `harian`: 7 hari terakhir kalender (per hari mundur dari hari ini)
 *       - Mode `mingguan`: 7 minggu terakhir kalender (per minggu mundur dari minggu ini)
 *       - Mode `bulanan`: 7 bulan terakhir kalender (per bulan mundur dari bulan ini)
 *       
 *       Setiap titik data menyertakan:
 *       - jumlah_cetak
 *       - jumlah_masak
 *       - total_harga (nominal & format Rupiah)
 *     tags:
 *       - Dashboard
 *     parameters:
 *       - in: query
 *         name: mode
 *         required: false
 *         schema:
 *           type: string
 *           enum: [harian, mingguan, bulanan]
 *           default: harian
 *         description: Mode grafik yang diinginkan (harian = 7 hari terakhir, mingguan = 7 minggu terakhir, bulanan = 7 bulan terakhir)
 *     responses:
 *       200:
 *         description: Berhasil memuat data grafik analitik
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Data grafik analitik (harian) berhasil dimuat
 *                 data:
 *                   type: object
 *                   properties:
 *                     tanggal_hari_ini_sistem:
 *                       type: string
 *                       example: "2026-10-28"
 *                     mode_terpilih:
 *                       type: string
 *                       example: "harian"
 *                     data:
 *                       type: array
 *                       description: Deret data grafik sesuai mode yang dipilih
 *                       items:
 *                         type: object
 *                     harian:
 *                       type: array
 *                       description: Data 7 hari terakhir
 *                       items:
 *                         type: object
 *                     mingguan:
 *                       type: array
 *                       description: Data 7 minggu terakhir
 *                       items:
 *                         type: object
 *                     bulanan:
 *                       type: array
 *                       description: Data 7 bulan terakhir
 *                       items:
 *                         type: object
 *       401:
 *         description: Unauthorized - Sesi login tidak valid
 *       500:
 *         description: Terjadi kesalahan server
 */
export async function GET(request: Request) {
  try {
    const { error: authError } = verifyDualAuth(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'harian';

    const metrics = await getDashboardMetrics(mode);

    return NextResponse.json({
      status: 'success',
      message: `Data grafik analitik (${metrics.grafik.mode_terpilih}) berhasil dimuat`,
      data: {
        tanggal_hari_ini_sistem: metrics.todayWib,
        mode_terpilih: metrics.grafik.mode_terpilih,
        data: metrics.grafik.data,
        harian: metrics.grafik.harian,
        mingguan: metrics.grafik.mingguan,
        bulanan: metrics.grafik.bulanan,
      },
    });
  } catch (error) {
    console.error('[API Dashboard Grafik Error]:', error);
    return NextResponse.json(
      { status: 'error', message: 'Gagal memuat data grafik analitik', details: String(error) },
      { status: 500 }
    );
  }
}
