import { NextResponse } from 'next/server';
import { verifyDualAuth } from '@/lib/auth-check';
import { getDashboardMetrics } from '@/lib/dashboard-service';

/**
 * @swagger
 * /api/dashboard/mingguan:
 *   get:
 *     summary: Mendapatkan data statistik produksi & pesanan mingguan (7 hari kalender terakhir)
 *     description: |
 *       Menampilkan data statistik produksi dan pesanan selama 7 hari kalender terakhir sampai hari ini:
 *       - Rentang tanggal periode (tanggal awal & akhir)
 *       - Total cetak 7 hari
 *       - Total masak 7 hari
 *       - Total pendapatan 7 hari (nominal dan format Rupiah)
 *       - Total transaksi pesanan pelanggan
 *       - Rincian data produksi per hari dalam 7 hari terakhir
 *     tags:
 *       - Dashboard
 *     responses:
 *       200:
 *         description: Berhasil memuat data statistik dashboard mingguan
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
 *                   example: Data statistik dashboard mingguan berhasil dimuat
 *                 data:
 *                   type: object
 *                   properties:
 *                     tanggal_hari_ini_sistem:
 *                       type: string
 *                       example: "2026-10-28"
 *                     mingguan:
 *                       type: object
 *                       properties:
 *                         periode:
 *                           type: string
 *                           example: "22 Okt - 28 Okt"
 *                         tanggal_awal:
 *                           type: string
 *                           example: "2026-10-22"
 *                         tanggal_akhir:
 *                           type: string
 *                           example: "2026-10-28"
 *                         total_cetak:
 *                           type: integer
 *                           example: 125
 *                         total_masak:
 *                           type: integer
 *                           example: 45
 *                         total_pendapatan:
 *                           type: integer
 *                           example: 625000
 *                         total_pendapatan_rupiah:
 *                           type: string
 *                           example: "Rp 625.000"
 *                         total_transaksi_pelanggan:
 *                           type: integer
 *                           example: 12
 *                     pesanan_mingguan:
 *                       type: object
 *                       properties:
 *                         periode:
 *                           type: string
 *                           example: "22 Okt - 28 Okt"
 *                         total_transaksi_pelanggan:
 *                           type: integer
 *                           example: 12
 *                         total_cetak:
 *                           type: integer
 *                           example: 125
 *                         total_masak:
 *                           type: integer
 *                           example: 45
 *                         total_pendapatan:
 *                           type: integer
 *                           example: 625000
 *                         total_pendapatan_rupiah:
 *                           type: string
 *                           example: "Rp 625.000"
 *                     rincian_7_hari:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           tanggal:
 *                             type: string
 *                           label:
 *                             type: string
 *                           hari:
 *                             type: string
 *                           is_hari_ini:
 *                             type: boolean
 *                           jumlah_cetak:
 *                             type: integer
 *                           jumlah_masak:
 *                             type: integer
 *                           total_harga:
 *                             type: integer
 *                           total_harga_rupiah:
 *                             type: string
 *       401:
 *         description: Unauthorized - Sesi login tidak valid
 *       500:
 *         description: Terjadi kesalahan server
 */
export async function GET(request: Request) {
  try {
    const { error: authError } = verifyDualAuth(request);
    if (authError) return authError;

    const metrics = await getDashboardMetrics();

    return NextResponse.json({
      status: 'success',
      message: 'Data statistik dashboard mingguan berhasil dimuat',
      data: {
        tanggal_hari_ini_sistem: metrics.todayWib,
        mingguan: metrics.mingguan,
        pesanan_mingguan: metrics.pesanan.mingguan,
        rincian_7_hari: metrics.grafik.harian,
      },
    });
  } catch (error) {
    console.error('[API Dashboard Mingguan Error]:', error);
    return NextResponse.json(
      { status: 'error', message: 'Gagal memuat data statistik mingguan', details: String(error) },
      { status: 500 }
    );
  }
}
