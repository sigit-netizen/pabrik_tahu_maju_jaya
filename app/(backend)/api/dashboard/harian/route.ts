import { NextResponse } from 'next/server';
import { verifyDualAuth } from '@/lib/auth-check';
import { getDashboardMetrics } from '@/lib/dashboard-service';

/**
 * @swagger
 * /api/dashboard/harian:
 *   get:
 *     summary: Mendapatkan data statistik harian & pesanan hari ini berdasarkan tanggal kalender
 *     description: |
 *       Menampilkan data produksi dan pesanan pelanggan untuk tanggal hari ini (WIB):
 *       - Tanggal hari ini (kalender sistem WIB)
 *       - Jumlah cetak hari ini
 *       - Jumlah masak hari ini
 *       - Total harga hari ini (nominal dan format Rupiah)
 *       - Daftar pesanan pelanggan yang masuk hari ini
 *       - Data terakhir masuk sebagai referensi perbandingan jika hari ini belum ada aktivitas
 *     tags:
 *       - Dashboard
 *     responses:
 *       200:
 *         description: Berhasil memuat data statistik dashboard harian
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
 *                   example: Data statistik dashboard harian berhasil dimuat
 *                 data:
 *                   type: object
 *                   properties:
 *                     tanggal_hari_ini_sistem:
 *                       type: string
 *                       example: "2026-10-28"
 *                     harian:
 *                       type: object
 *                       properties:
 *                         tanggal:
 *                           type: string
 *                           example: "2026-10-28"
 *                         tanggal_wib:
 *                           type: string
 *                           example: "Rabu, 28 Oktober 2026"
 *                         jumlah_cetak:
 *                           type: integer
 *                           example: 0
 *                         jumlah_masak:
 *                           type: integer
 *                           example: 0
 *                         total_harga:
 *                           type: integer
 *                           example: 0
 *                         total_harga_rupiah:
 *                           type: string
 *                           example: "Rp 0"
 *                         total_pelanggan:
 *                           type: integer
 *                           example: 0
 *                         pesanan_pelanggan:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               nama:
 *                                 type: string
 *                               jumlah_cetak:
 *                                 type: integer
 *                               jumlah_masak:
 *                                 type: integer
 *                               total_harga:
 *                                 type: integer
 *                               total_harga_rupiah:
 *                                 type: string
 *                               waktu_wib:
 *                                 type: string
 *                     pesanan_harian:
 *                       type: object
 *                       properties:
 *                         tanggal:
 *                           type: string
 *                           example: "2026-10-28"
 *                         total_pelanggan:
 *                           type: integer
 *                           example: 0
 *                         total_cetak:
 *                           type: integer
 *                           example: 0
 *                         total_masak:
 *                           type: integer
 *                           example: 0
 *                         total_pendapatan:
 *                           type: integer
 *                           example: 0
 *                         total_pendapatan_rupiah:
 *                           type: string
 *                           example: "Rp 0"
 *                         rincian_pelanggan:
 *                           type: array
 *                           items:
 *                             type: object
 *                     data_terakhir_masuk:
 *                       type: object
 *                       properties:
 *                         tanggal:
 *                           type: string
 *                           example: "2026-10-27"
 *                         tanggal_wib:
 *                           type: string
 *                           example: "Selasa, 27 Oktober 2026"
 *                         jumlah_cetak:
 *                           type: integer
 *                           example: 50
 *                         jumlah_masak:
 *                           type: integer
 *                           example: 20
 *                         total_harga:
 *                           type: integer
 *                           example: 250000
 *                         total_harga_rupiah:
 *                           type: string
 *                           example: "Rp 250.000"
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
      message: 'Data statistik dashboard harian berhasil dimuat',
      data: {
        tanggal_hari_ini_sistem: metrics.todayWib,
        harian: metrics.harian,
        pesanan_harian: metrics.pesanan.harian,
        data_terakhir_masuk: metrics.data_terakhir_masuk,
      },
    });
  } catch (error) {
    console.error('[API Dashboard Harian Error]:', error);
    return NextResponse.json(
      { status: 'error', message: 'Gagal memuat data statistik harian', details: String(error) },
      { status: 500 }
    );
  }
}
