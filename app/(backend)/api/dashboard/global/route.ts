import { NextResponse } from 'next/server';
import { verifyDualAuth } from '@/lib/auth-check';
import { getDashboardMetrics } from '@/lib/dashboard-service';

/**
 * @swagger
 * /api/dashboard/global:
 *   get:
 *     summary: Mendapatkan data statistik cetakan & pesanan global (sepanjang masa)
 *     description: |
 *       Menampilkan akumulasi data produksi sepanjang masa:
 *       - Total cetakan global
 *       - Total masakan global
 *       - Total pendapatan global (nominal dan format Rupiah)
 *       - Rata-rata cetakan harian
 *       - Tarif harga cetak aktif
 *       - Total hari produksi
 *       - Rekap transaksi pelanggan global
 *     tags:
 *       - Dashboard
 *     responses:
 *       200:
 *         description: Berhasil memuat data statistik dashboard global
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
 *                   example: Data statistik dashboard global berhasil dimuat
 *                 data:
 *                   type: object
 *                   properties:
 *                     tanggal_hari_ini_sistem:
 *                       type: string
 *                       example: "2026-10-28"
 *                     cetakan_global:
 *                       type: object
 *                       properties:
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
 *                         rata_rata_cetak_harian:
 *                           type: integer
 *                           example: 42
 *                         harga_cetak_aktif:
 *                           type: integer
 *                           example: 5000
 *                         total_hari_produksi:
 *                           type: integer
 *                           example: 3
 *                     pesanan_global:
 *                       type: object
 *                       properties:
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
      message: 'Data statistik dashboard global berhasil dimuat',
      data: {
        tanggal_hari_ini_sistem: metrics.todayWib,
        cetakan_global: metrics.cetakan_global,
        pesanan_global: metrics.pesanan.global,
      },
    });
  } catch (error) {
    console.error('[API Dashboard Global Error]:', error);
    return NextResponse.json(
      { status: 'error', message: 'Gagal memuat data statistik global', details: String(error) },
      { status: 500 }
    );
  }
}
